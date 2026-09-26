import { db } from './firebase.ts';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { Recipe, GroceryList, GroceryItem } from '../types/recipe.ts';

const RECIPES_COLLECTION = 'recipes';
const LISTS_COLLECTION = 'grocery_lists';

export const firestoreService = {
  // Save or update a recipe in Firestore
  async saveRecipe(recipe: Recipe): Promise<void> {
    try {
      const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
      await setDoc(recipeRef, {
        ...recipe,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore saveRecipe failed, falling back:', err);
    }
  },

  // Delete a recipe
  async deleteRecipe(id: string): Promise<void> {
    try {
      const recipeRef = doc(db, RECIPES_COLLECTION, id);
      await deleteDoc(recipeRef);
    } catch (err) {
      console.warn('Firestore deleteRecipe failed:', err);
    }
  },

  // Listen to real-time recipes
  subscribeRecipes(onUpdate: (recipes: Recipe[]) => void): Unsubscribe {
    try {
      const colRef = collection(db, RECIPES_COLLECTION);
      return onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const list: Recipe[] = [];
          snapshot.forEach((d) => list.push(d.data() as Recipe));
          onUpdate(list);
        }
      }, (err) => {
        console.warn('Firestore subscribeRecipes listener error:', err);
      });
    } catch (err) {
      console.warn('Failed to subscribe recipes:', err);
      return () => {};
    }
  },

  // Save or update a grocery list
  async saveGroceryList(list: GroceryList): Promise<void> {
    try {
      const listRef = doc(db, LISTS_COLLECTION, list.id);
      await setDoc(listRef, {
        ...list,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore saveGroceryList failed:', err);
    }
  },

  // Listen to real-time grocery lists
  subscribeGroceryLists(onUpdate: (lists: GroceryList[]) => void): Unsubscribe {
    try {
      const colRef = collection(db, LISTS_COLLECTION);
      return onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const lists: GroceryList[] = [];
          snapshot.forEach((d) => lists.push(d.data() as GroceryList));
          onUpdate(lists);
        }
      }, (err) => {
        console.warn('Firestore subscribeGroceryLists listener error:', err);
      });
    } catch (err) {
      console.warn('Failed to subscribe grocery lists:', err);
      return () => {};
    }
  },
};
