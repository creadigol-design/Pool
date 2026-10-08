// Teams listed on the picker screen: anyone who opens the site can tap these. Leave empty to keep
// every team private (members join by typing the team code or opening an invite link).
window.PRESET_TEAMS = [];

// Private teams the app recognises once their code is typed (name + starting squad/fixtures).
// `fingerprint` is sha256("preset:" + code, lower-cased), a one-way hash, so the code itself isn't in the site.
window.KNOWN_TEAMS = [
  { name: "Tafarn y Fic", template: "tafarn", fingerprint: "c97e7942502fab657f71798fdd087612a030fd4515b958e7556c1bb0e5be27d2" },
];

// Firebase web config. This identifies the project; it is not a secret.
// Access is controlled by firestore.rules, not by hiding this file.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCafRAZJjrC14rNKyxuciA93D50tyyGlKE",
  authDomain: "tafarn-y-fic-pool.firebaseapp.com",
  projectId: "tafarn-y-fic-pool",
  storageBucket: "tafarn-y-fic-pool.firebasestorage.app",
  messagingSenderId: "1007141234111",
  appId: "1:1007141234111:web:372349718bbec082616d0a"
};
