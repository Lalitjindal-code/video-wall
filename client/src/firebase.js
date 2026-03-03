import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCeOdVVgEhsbuXkQVl_JYOZBhwfanT2cbs",
    authDomain: "human-video-wall.firebaseapp.com",
    projectId: "human-video-wall",
    storageBucket: "human-video-wall.firebasestorage.app",
    messagingSenderId: "912940563400",
    appId: "1:912940563400:web:5a75d82af62d7912b4defd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
