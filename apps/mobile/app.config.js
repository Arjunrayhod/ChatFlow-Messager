const fs = require('fs');
const path = require('path');

const expo = require('./app.json').expo;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

if (easProjectId) {
  expo.extra = { ...expo.extra, eas: { ...expo.extra?.eas, projectId: easProjectId } };
}

// Keep ordinary development builds working until the Firebase Android config is supplied.
const googleServicesFile = path.join(__dirname, 'google-services.json');
if (fs.existsSync(googleServicesFile)) {
  expo.android.googleServicesFile = './google-services.json';
}

module.exports = { expo };
