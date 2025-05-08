require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const SOURCE_LANG = 'pt';
const TARGET_LANGS = ['en', 'es'];
const i18nDir = path.join(__dirname, '../src/assets/i18n');

const translate = new AWS.Translate({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const translateText = async (text, targetLang) => {
  try {
    const params = {
      SourceLanguageCode: SOURCE_LANG,
      TargetLanguageCode: targetLang,
      Text: text
    };
    const result = await translate.translateText(params).promise();
    return result.TranslatedText;
  } catch (err) {
    console.error(`Erro ao traduzir "${text}" para ${targetLang}:`, err.message);
    return '';
  }
};

// Funções auxiliares
const flatten = (obj, prefix = '', res = {}) => {
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'object' && val !== null) {
      flatten(val, newKey, res);
    } else {
      res[newKey] = val;
    }
  }
  return res;
};

const unflatten = (flat) => {
  const result = {};
  for (const key in flat) {
    const keys = key.split('.');
    keys.reduce((acc, part, i) => {
      if (i === keys.length - 1) {
        acc[part] = flat[key];
      } else {
        acc[part] = acc[part] || {};
      }
      return acc[part];
    }, result);
  }
  return result;
};

const main = async () => {
  const sourcePath = path.join(i18nDir, `${SOURCE_LANG}.json`);
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const flatSource = flatten(source);

  for (const lang of TARGET_LANGS) {
    const targetPath = path.join(i18nDir, `${lang}.json`);
    const target = fs.existsSync(targetPath)
      ? JSON.parse(fs.readFileSync(targetPath, 'utf8'))
      : {};
    const flatTarget = flatten(target);

    const missingKeys = Object.keys(flatSource).filter(key => !flatTarget[key]);

    if (missingKeys.length === 0) {
      console.log(`✅ ${lang}.json está atualizado.`);
      continue;
    }

    console.log(`🔄 Traduzindo ${missingKeys.length} entradas para ${lang}...`);

    for (const key of missingKeys) {
      const originalText = flatSource[key];
      const translated = await translateText(originalText, lang);
      flatTarget[key] = translated;
      console.log(`  - ${key}: "${originalText}" ➡ "${translated}"`);
    }

    const rebuilt = unflatten(flatTarget);
    fs.writeFileSync(targetPath, JSON.stringify(rebuilt, null, 2), 'utf8');
    console.log(`✅ Arquivo salvo: ${lang}.json`);
  }
};

main();