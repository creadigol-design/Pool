// Teams shown on the picker screen, one tap to open. Anyone who uses the site can open these,
// so only list teams you're happy for every visitor to see and edit. To keep a team private,
// leave it off this list: its members join with the code (or an invite link) instead.
window.PRESET_TEAMS = [
  { name: "Tafarn y Fic", code: "tafarn y fic", template: "tafarn" },
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
