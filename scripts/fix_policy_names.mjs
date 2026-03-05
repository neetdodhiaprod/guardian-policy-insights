import fs from 'fs';
import path from 'path';

// Explicit clean name overrides keyed by "insurer/filename" (without .json)
// Derived from the actual product brand names
const OVERRIDES = {
  // Aditya Birla
  'aditya-birla/Activ_Assured_Diamond':        'Activ Assured Diamond',
  'aditya-birla/Activ_Care_Classic':            'Activ Care Classic',
  'aditya-birla/Activ_Care_Premier':            'Activ Care Premier',
  'aditya-birla/Activ_Care_Standard':           'Activ Care Standard',
  'aditya-birla/Activ_Fit_Plus':                'Activ Fit Plus',
  'aditya-birla/Activ_Fit_Preferred':           'Activ Fit Preferred',
  'aditya-birla/Activ_Health_Platinum_Enhanced':'Activ Health Platinum Enhanced',
  'aditya-birla/Activ_Health_Platinum_Essential':'Activ Health Platinum Essential',
  'aditya-birla/Activ_Health_Plus_TopUp':       'Activ Health Plus Top-Up',
  'aditya-birla/Activ_One_MAX':                 'Activ One MAX',
  'aditya-birla/Activ_One_MAX_Plus':            'Activ One MAX+',
  'aditya-birla/Activ_One_NXT':                 'Activ One NXT',
  'aditya-birla/Activ_One_SAVR':                'Activ One SAVR',
  'aditya-birla/Activ_One_VIP':                 'Activ One VIP',
  'aditya-birla/Activ_One_VIP_Plus':            'Activ One VIP+',
  'aditya-birla/Activ_One_VYTL':                'Activ One VYTL',

  // Care
  'care/Care_Advantage':                        'Care Advantage',
  'care/Care_Care':                             'Care',
  'care/Care_Classic':                          'Care Classic',
  'care/Care_Enhance_Top_Up':                   'Care Enhance Top-Up',
  'care/Care_Freedom':                          'Care Freedom',
  'care/Care_Heart':                            'Care Heart',
  'care/Care_Joy_Today':                        'Care Joy Today',
  'care/Care_Joy_Tomorrow':                     'Care Joy Tomorrow',
  'care/Care_Plus_Complete':                    'Care Plus Complete',
  'care/Care_Plus_Youth':                       'Care Plus Youth',
  'care/Care_Senior':                           'Care Senior',
  'care/Care_Senior_Health_Advantage':          'Senior Health Advantage',
  'care/Care_Supreme':                          'Care Supreme',
  'care/Care_Supreme_Enhance_Super_TopUp':      'Care Supreme Enhance Super Top-Up',
  'care/Care_Supreme_Senior_Premium':           'Care Supreme Senior Premium',
  'care/Care_Supreme_Senior_Super':             'Care Supreme Senior Super',
  'care/Care_Supreme_Super_Saver':              'Care Supreme Super Saver',
  'care/Care_Supreme_VFM':                      'Care Supreme VFM',
  'care/Care_Ultimate':                         'Care Ultimate',

  // HDFC ERGO
  'hdfc-ergo/Easy_Health_Exclusive':            'Easy Health Exclusive',
  'hdfc-ergo/Easy_Health_Premium':              'Easy Health Premium',
  'hdfc-ergo/Easy_Health_Standard':             'Easy Health Standard',
  'hdfc-ergo/Energy_Gold':                      'Energy Gold',
  'hdfc-ergo/Energy_Silver':                    'Energy Silver',
  'hdfc-ergo/Equicover':                        'EquiCover',
  'hdfc-ergo/Health_Wallet':                    'Health Wallet',
  'hdfc-ergo/MyHealth_Koti_Suraksha':           'MyHealth Koti Suraksha',
  'hdfc-ergo/MyHealth_Medisure_Super_TopUp':    'MyHealth Medisure Super Top-Up',
  'hdfc-ergo/MyHealth_Suraksha_Gold':           'MyHealth Suraksha Gold',
  'hdfc-ergo/MyHealth_Suraksha_Platinum':       'MyHealth Suraksha Platinum',
  'hdfc-ergo/MyHealth_Suraksha_Silver':         'MyHealth Suraksha Silver',
  'hdfc-ergo/Optima_Lite':                      'Optima Lite',
  'hdfc-ergo/Optima_Restore':                   'Optima Restore',
  'hdfc-ergo/Optima_Secure':                    'Optima Secure',
  'hdfc-ergo/Optima_Secure_Global':             'Optima Secure Global',
  'hdfc-ergo/Optima_Secure_Global_Plus':        'Optima Secure Global Plus',
  'hdfc-ergo/Optima_Senior':                    'Optima Senior',
  'hdfc-ergo/Optima_Super_Secure':              'Optima Super Secure',

  // ICICI Lombard
  'icici-lombard/Elevate':                      'Elevate',
  'icici-lombard/Golden_Shield':                'Golden Shield',
  'icici-lombard/Health_AdvantEdge':            'Health AdvantEdge',
  'icici-lombard/Health_Booster_Super_TopUp':   'Health Booster Super Top-Up',
  'icici-lombard/Health_Elite_Plus':            'Health Elite Plus',
  'icici-lombard/Health_Shield_360':            'Health Shield 360',
  'icici-lombard/Health_Shield_360_Retail':     'Health Shield 360 Retail',
  'icici-lombard/Max_Protect_Classic':          'MaxProtect Classic',
  'icici-lombard/Max_Protect_Premium':          'MaxProtect Premium',
  'icici-lombard/iHealth':                      'iHealth',
  'icici-lombard/iHealth_Plus':                 'iHealth Plus',

  // Niva Bupa
  'niva-bupa/Aspire_Diamond_Plus':              'Aspire Diamond+',
  'niva-bupa/Aspire_Gold_Plus':                 'Aspire Gold+',
  'niva-bupa/Aspire_Platinum_Plus':             'Aspire Platinum+',
  'niva-bupa/Aspire_Titanium_Plus':             'Aspire Titanium+',
  'niva-bupa/GoActive':                         'GoActive',
  'niva-bupa/Health_Companion':                 'Health Companion',
  'niva-bupa/Health_Premia_Gold':               'Health Premia Gold',
  'niva-bupa/Health_Premia_Platinum':           'Health Premia Platinum',
  'niva-bupa/Health_Premia_Silver':             'Health Premia Silver',
  'niva-bupa/Health_Pulse_Classic':             'Health Pulse Classic',
  'niva-bupa/Health_Pulse_Enhanced':            'Health Pulse Enhanced',
  'niva-bupa/Health_Recharge_Super_TopUp':      'Health Recharge Super Top-Up',
  'niva-bupa/HeartBeat_Gold':                   'HeartBeat Gold',
  'niva-bupa/HeartBeat_Platinum':               'HeartBeat Platinum',
  'niva-bupa/ReAssure':                         'ReAssure',
  'niva-bupa/ReAssure_2_Bronze_Plus':           'ReAssure 2.0 Bronze+',
  'niva-bupa/ReAssure_2_Platinum_Plus':         'ReAssure 2.0 Platinum+',
  'niva-bupa/ReAssure_2_Titanium_Plus':         'ReAssure 2.0 Titanium+',
  'niva-bupa/Senior_First_Gold':                'Senior First Gold',
  'niva-bupa/Senior_First_Platinum':            'Senior First Platinum',

  // Star Health
  'star-health-care/Assure':                    'Star Assure',
  'star-health-care/Cancer_Care_Platinum':      'Cancer Care Platinum',
  'star-health-care/Cardiac_Care_Platinum':     'Cardiac Care Platinum',
  'star-health-care/Comprehensive':             'Comprehensive',
  'star-health-care/Diabetes_Safe':             'Diabetes Safe',
  'star-health-care/Family_Health_Optima':      'Family Health Optima',
  'star-health-care/Health_Premier':            'Health Premier',
  'star-health-care/Medi_Classic':              'Medi Classic',
  'star-health-care/Medi_Classic_Gold':         'Medi Classic Gold',
  'star-health-care/Red_Carpet_Senior_Citizen': 'Red Carpet Senior Citizen',
  'star-health-care/Smart_Health_Pro':          'Smart Health Pro',
  'star-health-care/Special_Care':              'Special Care',
  'star-health-care/Special_Care_Gold':         'Special Care Gold',
  'star-health-care/Star_Health_Gain':          'Star Health Gain',
  'star-health-care/Super_Star':                'Super Star',
  'star-health-care/Super_Surplus_Gold':        'Super Surplus Gold',
  'star-health-care/Women_Care':                'Women Care',
  'star-health-care/Young_Star':                'Young Star',
};

let updated = 0, skipped = 0;

for (const insurer of fs.readdirSync('out').sort()) {
  const dir = path.join('out', insurer);
  if (!fs.statSync(dir).isDirectory()) continue;

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;

    const key = `${insurer}/${file.replace('.json', '')}`;
    const cleanName = OVERRIDES[key];

    if (!cleanName) {
      console.warn(`[MISSING OVERRIDE] ${key}`);
      skipped++;
      continue;
    }

    const fp = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

    if (data.policyName === cleanName) {
      skipped++;
      continue;
    }

    console.log(`${key}`);
    console.log(`  was: ${data.policyName}`);
    console.log(`  now: ${cleanName}`);
    data.policyName = cleanName;
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
    updated++;
  }
}

console.log(`\nUpdated: ${updated}  Skipped/unchanged: ${skipped}`);
