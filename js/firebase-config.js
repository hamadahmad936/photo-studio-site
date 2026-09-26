const firebaseConfig = {
  apiKey: "AIzaSyCDjaTR-E3jT6R-PhkCdfm-1fSXEiiEZnk",
  authDomain: "photo-studio-site.firebaseapp.com",
  projectId: "photo-studio-site",
  storageBucket: "photo-studio-site.firebasestorage.app",
  messagingSenderId: "834061655654",
  appId: "1:834061655654:web:d17f554ad993f82a7d57a7",
  measurementId: "G-0RVNHJLPTP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
if (firebase.analytics) {
  firebase.analytics();
}