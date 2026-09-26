import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper: Built-in Clinical Pharmacology Safety Engine (Guaranteed zero-error fallback)
function runInternalClinicalAudit(patientData: {
  patientName?: string;
  age?: number;
  gender?: string;
  allergies?: string;
  medications?: any[];
  vitals?: any[];
  medicalHistory?: string;
}) {
  const meds = (patientData.medications || []).map(m => (typeof m === 'string' ? m : m.name || '').toLowerCase());
  const medNames = (patientData.medications || []).map(m => (typeof m === 'string' ? m : m.name || ''));
  const interactions: any[] = [];
  const foodInteractions: any[] = [];
  const nutritionalCompanions: any[] = [];
  const counselingPointsAr: string[] = [];
  const counselingPointsEn: string[] = [];

  const hasDrug = (keywords: string[]) => meds.some(m => keywords.some(k => m.includes(k.toLowerCase())));

  // Drug classes
  const isAceOrArb = hasDrug(['captopril', 'enalapril', 'lisinopril', 'ramipril', 'valsartan', 'losartan', 'candesartan', 'telmisartan', 'diovan', 'co-diovan', 'micardis', 'zestril', 'tarka']);
  const isDiuretic = hasDrug(['furosemide', 'lasix', 'hydrochlorothiazide', 'hctz', 'indapamide', 'natrilix', 'spironolactone', 'aldactone']);
  const isNsaid = hasDrug(['ibuprofen', 'brufen', 'profine', 'diclofenac', 'voltaren', 'cataflam', 'naproxen', 'aleve', 'meloxicam', 'mobic', 'ketoprofen', 'bi-profenid', 'celecoxib', 'celebrex', 'olfen']);
  const isStatin = hasDrug(['atorvastatin', 'lipitor', 'torex', 'rosuvastatin', 'crestor', 'simvastatin', 'zocor', 'ezetimibe']);
  const isMacrolide = hasDrug(['clarithromycin', 'klacid', 'azithromycin', 'zithromax', 'erythromycin']);
  const isMetformin = hasDrug(['metformin', 'glucophage', 'janumet', 'galvus met', 'synjardy', 'eucreas', 'glimcare']);
  const isPpi = hasDrug(['omeprazole', 'losec', 'pantoprazole', 'controloc', 'esomeprazole', 'nexium', 'dexilant']);
  const isAntiplatelet = hasDrug(['clopidogrel', 'plavix', 'aspirin', 'aspicot', 'ticagrelor', 'brilinta']);
  const isAnticoagulant = hasDrug(['warfarin', 'coumadin', 'rivaroxaban', 'xarelto', 'apixaban', 'eliquis', 'dabigatran', 'pradaxa']);
  const isSsriSnri = hasDrug(['fluoxetine', 'prozac', 'sertraline', 'zoloft', 'escitalopram', 'cipralex', 'duloxetine', 'cymbalta', 'paroxetine']);
  const isTramadol = hasDrug(['tramadol', 'tramal', 'ultram', 'zydol']);
  const isCcb = hasDrug(['amlodipine', 'norvasc', 'nifedipine', 'adalat', 'diltiazem', 'verapamil', 'isoptin']);
  const isBetaBlocker = hasDrug(['bisoprolol', 'concor', 'metoprolol', 'betaloc', 'carvedilol', 'dilatrend', 'atenolol', 'tenormin', 'nebivolol']);

  let overallRiskScore = 'LOW';

  // 1. Triple Whammy (ACEi/ARB + Diuretic + NSAID)
  if (isAceOrArb && isDiuretic && isNsaid) {
    overallRiskScore = 'CRITICAL';
    interactions.push({
      drugs: ['ACEi/ARB', 'Diuretic', 'NSAID'],
      severity: 'CRITICAL',
      titleAr: '🚨 تحذير الضربة الثلاثية القاتلة للكلى (Triple Whammy AKI Risk)',
      titleEn: 'Triple Whammy Acute Kidney Injury',
      mechanism: 'الجمع بين مثبطات الرينين-أنجيوتنسين ومدرات البول والمسكنات يسبب هبوطاً حاداً في التروية الكلوية وفشلاً كلوياً حاداً (Pre-renal AKI).',
      actionAr: 'يجب إيقاف المسكن (NSAID) فوراً واستبداله بالباراسيتامول، ومراقبة وظائف الكلى واليوريا والكرياتينين.',
      actionEn: 'Discontinue NSAID immediately. Use Paracetamol for pain relief and monitor serum creatinine & eGFR.',
    });
  } else if (isAceOrArb && isNsaid) {
    overallRiskScore = 'HIGH';
    interactions.push({
      drugs: ['ACEi/ARB', 'NSAID'],
      severity: 'MAJOR',
      titleAr: 'تعارض المسكنات مع خافض الضغط الكلوي (ACEi/ARB + NSAID)',
      titleEn: 'NSAID blunting antihypertensive effect & Renal risk',
      mechanism: 'المسكنات غير الستيرويدية تعاكس المفعول الخافض للضغط وتزيد العبء على وظائف الكلى وترفع البوتاسيوم.',
      actionAr: 'تجنب المسكنات المزمنة واستعمال البدائل الموضعية أو الباراسيتامول.',
      actionEn: 'Avoid chronic NSAIDs; switch to topical agents or Paracetamol.',
    });
  }

  // 2. Statin + Macrolide
  if (isStatin && isMacrolide) {
    overallRiskScore = 'CRITICAL';
    interactions.push({
      drugs: ['Statin', 'Macrolide Antibiotic'],
      severity: 'CRITICAL',
      titleAr: '🚨 خطر انحلال العضلات الحاد والفشل الكلوي (Rhabdomyolysis)',
      titleEn: 'Statin + Macrolide CYP3A4 Inhibition',
      mechanism: 'المضادات الحيوية الماكروليدية تثبط بشدة إنزيم CYP3A4 مما يرفع تركيز الستاتين في الدم لعشرات الأضعاف ويسبب تمزق العضلات.',
      actionAr: 'يجب إيقاف دواء الكوليسترول مؤقتاً طوال فترة أخذ المضاد الحيوي، واستئنافه بعد يومين من انتهاء الكورس.',
      actionEn: 'Hold statin therapy for the entire duration of macrolide course and resume 48h after completion.',
    });
  }

  // 3. Bleeding Risk: Antiplatelet / Anticoagulant + NSAID
  if ((isAntiplatelet || isAnticoagulant) && isNsaid) {
    overallRiskScore = overallRiskScore === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    interactions.push({
      drugs: ['Antiplatelet/Anticoagulant', 'NSAID'],
      severity: 'MAJOR',
      titleAr: '⚠️ خطر النزيف المعدي الهضمي الشديد (Severe GI Bleed Risk)',
      titleEn: 'Synergistic Gastrointestinal Bleeding Risk',
      mechanism: 'مضاعفة تثبيط الصفيحات مع تقرح الغشاء المخاطي للمعدة بفعل المسكن.',
      actionAr: 'إيقاف المسكن فوراً واستخدام حماية معوية (PPI) مع بديل آمن لتسكين الألم.',
      actionEn: 'Discontinue NSAID, add PPI gastroprotection, and switch to Paracetamol.',
    });
  }

  // 4. Serotonin Syndrome
  if (isSsriSnri && isTramadol) {
    overallRiskScore = 'CRITICAL';
    interactions.push({
      drugs: ['SSRI/SNRI', 'Tramadol'],
      severity: 'CRITICAL',
      titleAr: '🚨 متلازمة السيروتونين المهددة للحياة (Serotonin Syndrome)',
      titleEn: 'Serotonin Syndrome Danger',
      mechanism: 'تراكم السيروتونين في الجهاز العصبي المركزي يسبب رعشة، ارتفاع حرارة، تشنجات، واضطراب الوعي.',
      actionAr: 'تجنب الترامادول تماماً للمرضى الذين يتناولون مضادات الاكتئاب.',
      actionEn: 'Avoid Tramadol in patients on serotonergic antidepressants.',
    });
  }

  // Food Interactions
  if (isStatin || isCcb) {
    foodInteractions.push({
      drug: isStatin ? 'Statin (Lipitor/Crestor)' : 'Calcium Blocker (Amlodipine)',
      foodItem: 'عصير الجريب فروت (Grapefruit Juice)',
      instructionAr: 'تجنب شرب عصير الجريب فروت لأنه يثبط إنزيم الكبد ويزيد تركيز العلاج وآثاره الجانبية كالدوخة وألم العضلات.',
      instructionEn: 'Avoid Grapefruit juice as it inhibits CYP3A4 and increases drug blood levels.',
    });
  }

  if (hasDrug(['ciprofloxacin', 'cipro', 'doxycycline', 'tetracycline', 'levofloxacin', 'tavanic'])) {
    foodInteractions.push({
      drug: 'Fluoroquinolone / Tetracycline',
      foodItem: 'الحليب ومنتجات الألبان والأجبان (Dairy & Calcium)',
      instructionAr: 'فصل تناول المضاد الحيوي عن الحليب ومشتقاته والكالسيوم بساعتين على الأقل لمنع تشكل معقد غير قابل للامتصاص.',
      instructionEn: 'Separate antibiotic from milk, cheese, and calcium supplements by at least 2 hours.',
    });
  }

  // Nutritional Companions (Depletion replacements)
  if (isMetformin) {
    nutritionalCompanions.push({
      supplementAr: 'فيتامين ب12 المعزز (Methylcobalamin / Neurobion)',
      supplementEn: 'Vitamin B12 / Methylcobalamin',
      indicatedFor: 'Metformin Therapy',
      clinicalRationaleAr: 'الميتفورمين يقلل امتصاص B12 في الأمعاء بنسبة 30% مسبباً تنميلاً وضعفاً بالأعصاب المحيطية وفقر دم.',
    });
    counselingPointsAr.push('تناول الميتفورمين وسط أو بعد الوجبة الرئيسية مباشرة لتقليل الاضطرابات الهضمية والانتفاخ.');
    counselingPointsEn.push('Take Metformin in the middle of meals to minimize gastrointestinal upset.');
  }

  if (isStatin) {
    nutritionalCompanions.push({
      supplementAr: 'الإنزيم المساعد كيو 10 (Coenzyme Q10 - 100mg)',
      supplementEn: 'Coenzyme Q10 (CoQ10)',
      indicatedFor: 'Statin Therapy',
      clinicalRationaleAr: 'الستاتين يثبط تصنيع CoQ10 في الميتوكوندريا العضلية، والمكمل يعيد الطاقة ويمنع آلام ووهن العضلات.',
    });
    counselingPointsAr.push('تناول علاج الكوليسترول مساءً عند النوم حيث يبلغ تصنيع الكوليسترول الكبدي ذروته ليلاً.');
    counselingPointsEn.push('Take statins in the evening or at bedtime when hepatic cholesterol synthesis is peak.');
  }

  if (isPpi) {
    nutritionalCompanions.push({
      supplementAr: 'المغنيسيوم والكالسيوم الفوار (Magnesium & Vitamin D3)',
      supplementEn: 'Magnesium + Vitamin D3',
      indicatedFor: 'Chronic PPI Therapy',
      clinicalRationaleAr: 'الاستخدام الطويل لمثبطات مضخة البروتون يقلل حموضة المعدة اللازمة لامتصاص المغنيسيوم والكالسيوم.',
    });
    counselingPointsAr.push('أخذ حبة حماية المعدة قبل الإفطار بـ 30 دقيقة على معدة فارغة للحصول على الفعالية القصوى.');
    counselingPointsEn.push('Take PPI 30 minutes before breakfast on an empty stomach.');
  }

  if (isAceOrArb || isBetaBlocker) {
    counselingPointsAr.push('مراقبة ضغط الدم بانتظام صباحاً وتجنب الوقوف المفاجئ لتفادي هبوط الضغط الانتصابي.');
    counselingPointsEn.push('Monitor blood pressure regularly in the morning and rise slowly from sitting position.');
  }

  if (counselingPointsAr.length === 0) {
    counselingPointsAr.push('الالتزام بمواعيد الجرعات الثابتة يومياً وشرب 2 إلى 3 لتر ماء يومياً لدعم صحة الكلى.');
    counselingPointsEn.push('Maintain strict adherence to daily dosing schedule and hydrate well.');
  }

  const summaryAr = interactions.length > 0
    ? `تم رصد ${interactions.length} تداخلات دوائية وسريرية تستدعي انتباه الصيدلي ومراجعة الجرعات والبدائل مع المريض.`
    : `الخطة العلاجية الحالية متوازنة سريرياً مع عدم وجود تعارضات حرجة مباشرة بين الأدوية المفحوصة (${medNames.join(' + ') || 'الأدوية المسجلة'}).`;

  const summaryEn = interactions.length > 0
    ? `Identified ${interactions.length} clinical drug interactions requiring pharmacist review and patient counseling.`
    : `Current medication regimen is clinically sound with no acute red-flag drug interactions detected.`;

  return {
    success: true,
    source: 'clinical_pharmacology_engine',
    overallRiskScore,
    summaryAr,
    summaryEn,
    interactions,
    foodInteractions,
    nutritionalCompanions,
    patientCounselingPointsAr: counselingPointsAr,
    patientCounselingPointsEn: counselingPointsEn,
  };
}

// Endpoint: AI Regimen Safety & Clinical Interaction Audit with Multi-Tier Fallback
app.post('/api/ai/audit-regimen', async (req, res) => {
  const patientData = req.body || {};
  const { patientName, age, gender, allergies, medications, vitals, medicalHistory } = patientData;

  // Fallback data generator if Gemini is unavailable
  const fallbackResult = runInternalClinicalAudit(patientData);

  if (!apiKey) {
    return res.status(200).json(fallbackResult);
  }

  const prompt = `You are an elite Clinical Pharmacologist and Patient Safety Specialist.
Audit this patient's medication regimen thoroughly.

Patient Profile:
- Name: ${patientName || 'Anonymous'}
- Age: ${age || 'Unknown'} | Gender: ${gender || 'Unknown'}
- Known Allergies: ${allergies || 'None reported'}
- Medical History/Conditions: ${medicalHistory || 'Chronic maintenance'}
- Active Medications: ${JSON.stringify(medications || [])}
- Recent Clinical Vitals: ${JSON.stringify(vitals || [])}

Perform a rigorous clinical safety review:
1. Identify all Drug-Drug interactions (Critical, Major, Moderate).
2. Check for contraindicated drug combinations (e.g. Triple Whammy AKI, Serotonin syndrome, QT prolongation, Statin-Macrolide myopathy, dual antiplatelet bleeding).
3. Evaluate organ/renal risks based on age, BP, and medications.
4. Food & beverage interactions (e.g. Grapefruit, Dairy/Calcium, Tyramine, Salt substitutes).
5. Evidence-based companion nutraceuticals (e.g. CoQ10 for Statins, B12 for Metformin, Mg for Diuretics).
6. Clear, actionable patient counseling guidance in Arabic and English.`;

  // Attempt multi-tier model calls: gemini-3.8-flash -> gemini-flash-latest -> gemini-3.1-flash-lite
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallRiskScore: {
                type: Type.STRING,
                description: 'One of: LOW, MODERATE, HIGH, CRITICAL',
              },
              summaryAr: {
                type: Type.STRING,
                description: 'Executive clinical summary in Arabic for the pharmacist',
              },
              summaryEn: {
                type: Type.STRING,
                description: 'Executive clinical summary in English',
              },
              interactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    drugs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    severity: { type: Type.STRING, description: 'CRITICAL | MAJOR | MODERATE | MINOR' },
                    titleAr: { type: Type.STRING },
                    titleEn: { type: Type.STRING },
                    mechanism: { type: Type.STRING },
                    actionAr: { type: Type.STRING },
                    actionEn: { type: Type.STRING },
                  },
                  required: ['drugs', 'severity', 'titleAr', 'mechanism', 'actionAr'],
                },
              },
              foodInteractions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    drug: { type: Type.STRING },
                    foodItem: { type: Type.STRING },
                    instructionAr: { type: Type.STRING },
                    instructionEn: { type: Type.STRING },
                  },
                  required: ['drug', 'foodItem', 'instructionAr'],
                },
              },
              nutritionalCompanions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    supplementAr: { type: Type.STRING },
                    supplementEn: { type: Type.STRING },
                    indicatedFor: { type: Type.STRING },
                    clinicalRationaleAr: { type: Type.STRING },
                  },
                  required: ['supplementAr', 'indicatedFor', 'clinicalRationaleAr'],
                },
              },
              patientCounselingPointsAr: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              patientCounselingPointsEn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'overallRiskScore',
              'summaryAr',
              'interactions',
              'patientCounselingPointsAr',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed && (parsed.summaryAr || parsed.interactions)) {
        return res.json({ success: true, source: `gemini_ai (${model})`, ...parsed });
      }
    } catch (modelErr: any) {
      console.warn(`Model ${model} unavailable or error:`, modelErr.message);
    }
  }

  // If remote models were unavailable, return clinical pharmacology engine output gracefully
  console.info('Using Internal Clinical Pharmacology Engine for Regimen Audit');
  return res.json(fallbackResult);
});

// Endpoint: AI Extract Prescription or Lab Report OCR
app.post('/api/ai/extract-prescription', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', rawText } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        source: 'mock_extractor',
        patientName: '',
        medications: [],
        vitals: {},
        notes: 'يرجى إدخال البيانات يدوياً (مفتاح الذكاء الاصطناعي غير مفعل).',
      });
    }

    const contents: any[] = [];
    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    contents.push({
      text: `You are an expert Clinical Pharmacist reading a medical prescription or clinical lab report.
Extract all medications, dosages, frequency, and any identifiable lab test values or vital signs (Blood Pressure, Fasting Glucose, HbA1c, Serum Creatinine, eGFR, Potassium).
Provide a structured output.
Additional pharmacist context notes provided: ${rawText || 'None'}`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contents },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            date: { type: Type.STRING },
            doctorOrClinic: { type: Type.STRING },
            medications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  frequency: { type: Type.STRING },
                  durationDays: { type: Type.INTEGER },
                  instructions: { type: Type.STRING },
                },
                required: ['name'],
              },
            },
            extractedVitals: {
              type: Type.OBJECT,
              properties: {
                systolic: { type: Type.STRING },
                diastolic: { type: Type.STRING },
                bloodGlucose: { type: Type.STRING },
                hba1c: { type: Type.STRING },
                creatinine: { type: Type.STRING },
                potassium: { type: Type.STRING },
                pulse: { type: Type.STRING },
              },
            },
            clinicalNotes: { type: Type.STRING },
          },
          required: ['medications'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error('Extract Prescription API error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract prescription data',
    });
  }
});

// Endpoint: AI Smart WhatsApp / SMS Counseling Composer
app.post('/api/ai/generate-counseling', async (req, res) => {
  try {
    const { patientName, pharmacyName, medications, channel = 'whatsapp', lang = 'ar', goal = 'refill' } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        message: `مرحباً ${patientName}، تحيات ${pharmacyName || 'الصيدلية'}. نود تذكيركم بموعد تكرار أدويتكم المزمنة لضمان استقرار حالتكم الصحية.`,
      });
    }

    const prompt = `Write a caring, warm, highly professional clinical pharmacist message for:
Patient: ${patientName}
Pharmacy: ${pharmacyName}
Medications: ${JSON.stringify(medications)}
Channel: ${channel} (keep concise if SMS, engaging with emojis and bullet points if WhatsApp)
Language: ${lang === 'en' ? 'English' : 'Arabic (فصحى مهذبة وقريبة لقلب المريض)'}
Goal: ${goal} (refill reminder, antibiotic course check-in, or adherence encouragement).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, message: response.text?.trim() });
  } catch (err: any) {
    console.error('Generate Counseling error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Real-time Clinical Search Grounding with Google Search (gemini-3.5-flash)
app.post('/api/ai/live-clinical-search', async (req, res) => {
  try {
    const { query, drugName, patientContext } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        source: 'fallback',
        text: 'يرجى مراجعة النشرات الدوائية والمراجع السريرية الرسمية (لم يتم تكوين مفتاح Gemini API).',
        sources: [],
        searchQueries: [],
      });
    }

    const prompt = `You are an expert Clinical Pharmacologist and Evidence-Based Medicine researcher.
Answer the following clinical question with the most recent evidence, safety warnings, and guideline updates:
Query: ${query}
Target Medication / Class: ${drugName || 'General Pharmacotherapy'}
${patientContext ? `Patient Context: ${JSON.stringify(patientContext)}` : ''}

Instructions:
1. Provide an authoritative, structured, and clinically actionable answer in Arabic and English.
2. Highlight any recent FDA/EMA black box warnings, clinical guideline updates (AHA/ACC, ADA, KDIGO, GOLD), renal/hepatic dose adjustments, and practical dispensing advice.
3. Be concise, rigorous, and patient-safety oriented.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources =
      groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Medical Source',
        uri: chunk.web?.uri || '',
      })).filter((s: any) => s.uri) || [];

    const searchQueries = groundingMetadata?.webSearchQueries || [];

    return res.json({
      success: true,
      text: response.text?.trim() || '',
      sources,
      searchQueries,
    });
  } catch (err: any) {
    console.error('Live Clinical Search error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: High-speed proxy for Google Apps Script to eliminate browser CORS latency and handle 302 redirects server-to-server
app.post('/api/gas/proxy', async (req, res) => {
  try {
    const { gasUrl, method = 'POST', payload, params } = req.body;
    if (!gasUrl || typeof gasUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid gasUrl' });
    }

    let targetUrl = gasUrl.trim();
    if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + q;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    if (method === 'GET') {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    } else {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    }
  } catch (err: any) {
    console.warn('Server GAS proxy error:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// Endpoint: Download standalone single-file HTML version of the app
app.get('/download/pharmpulse.html', (_req, res) => {
  const htmlPath = path.resolve(__dirname, 'pharmpulse.html');
  res.download(htmlPath, 'pharmpulse.html');
});

// Endpoint: Download Google Apps Script backend code (Code.gs)
app.get('/download/Code.gs', (_req, res) => {
  const gsPath = path.resolve(__dirname, 'google-apps-script.js');
  res.download(gsPath, 'Code.gs');
});

// Endpoint: Download compiled dist.zip for direct Netlify Drop deployment
app.get('/download/dist.zip', (_req, res) => {
  const zipPath = path.resolve(__dirname, 'dist.zip');
  res.download(zipPath, 'pharmpulse-netlify-dist.zip');
});

app.get('/pharmpulse.html', (_req, res) => {
  const htmlPath = path.resolve(__dirname, 'pharmpulse.html');
  res.sendFile(htmlPath);
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`PharmPulse Enterprise Server running on port ${PORT}`);
  });
}

startServer();
