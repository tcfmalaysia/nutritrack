// Client-side IndexedDB storage for persistent data on any device
// This ensures data survives across sessions and works when opened from WhatsApp

import type { MealEntry, DailyGoal } from './types'

const DB_NAME = 'nutritrack'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('meals')) {
        const mealStore = db.createObjectStore('meals', { keyPath: 'id' })
        mealStore.createIndex('date', 'date', { unique: false })
        mealStore.createIndex('mealType', 'mealType', { unique: false })
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'date' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ===== MEALS =====

export async function getMeals(date?: string): Promise<MealEntry[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readonly')
    const store = tx.objectStore('meals')
    const request = date ? store.index('date').getAll(date) : store.getAll()
    request.onsuccess = () => {
      const meals = (request.result as MealEntry[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      resolve(meals)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getMealsInRange(from: string, to: string): Promise<MealEntry[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readonly')
    const store = tx.objectStore('meals')
    const request = store.getAll()
    request.onsuccess = () => {
      const meals = (request.result as MealEntry[]).filter(
        (m) => m.date >= from && m.date <= to
      )
      resolve(meals.sort((a, b) => a.date.localeCompare(b.date)))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function addMeal(meal: Omit<MealEntry, 'id' | 'createdAt'>): Promise<MealEntry> {
  const db = await openDB()
  const now = new Date().toISOString()
  const entry: MealEntry = { ...meal, id: genId(), createdAt: now } as MealEntry
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite')
    const store = tx.objectStore('meals')
    const request = store.add(entry)
    request.onsuccess = () => resolve(entry)
    request.onerror = () => reject(request.error)
  })
}

export async function updateMeal(id: string, updates: Partial<MealEntry>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite')
    const store = tx.objectStore('meals')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (!existing) { reject(new Error('Meal not found')); return }
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite')
    const store = tx.objectStore('meals')
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ===== GOALS =====

export async function getGoal(date: string): Promise<DailyGoal | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readonly')
    const store = tx.objectStore('goals')
    const request = store.get(date)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function setGoal(goal: DailyGoal & { date: string }): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite')
    const store = tx.objectStore('goals')
    const request = store.put({ ...goal, updatedAt: new Date().toISOString() })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ===== EXPORT / IMPORT =====

export async function exportAllData(): Promise<string> {
  const meals = await getMeals()
  const db = await openDB()
  const goals: DailyGoal[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readonly')
    const request = tx.objectStore('goals').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return JSON.stringify({ version: 1, exportDate: new Date().toISOString(), meals, goals }, null, 2)
}

export async function importAllData(json: string): Promise<{ meals: number; goals: number }> {
  const data = JSON.parse(json)
  if (!data.version || !data.meals) throw new Error('Invalid backup file')

  const db = await openDB()
  let mealCount = 0
  let goalCount = 0

  const mealTx = db.transaction('meals', 'readwrite')
  const mealStore = mealTx.objectStore('meals')
  for (const meal of data.meals) { mealStore.put(meal); mealCount++ }
  await new Promise<void>((resolve, reject) => { mealTx.oncomplete = () => resolve(); mealTx.onerror = () => reject(mealTx.error) })

  if (data.goals) {
    const goalTx = db.transaction('goals', 'readwrite')
    const goalStore = goalTx.objectStore('goals')
    for (const goal of data.goals) { goalStore.put(goal); goalCount++ }
    await new Promise<void>((resolve, reject) => { goalTx.oncomplete = () => resolve(); goalTx.onerror = () => reject(goalTx.error) })
  }

  return { meals: mealCount, goals: goalCount }
}
