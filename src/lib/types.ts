// Shared types for the app

export interface MealEntry {
  id: string
  date: string
  mealType: string
  foodName: string
  description?: string
  imageUrl?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  calcium: number
  iron: number
  magnesium: number
  potassium: number
  zinc: number
  phosphorus: number
  vitaminA: number
  vitaminC: number
  vitaminD: number
  vitaminB12: number
  servingSize?: string
  confidence: string
  aiNotes?: string
  createdAt: string
  updatedAt?: string
}

export interface DailyGoal {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  updatedAt?: string
}

export interface NutritionData {
  foodName: string
  servingSize: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  calcium: number
  iron: number
  magnesium: number
  potassium: number
  zinc: number
  phosphorus: number
  vitaminA: number
  vitaminC: number
  vitaminD: number
  vitaminB12: number
  confidence: string
  notes: string
}

export interface DailyTotal {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  calcium: number
  iron: number
  magnesium: number
  potassium: number
  zinc: number
  phosphorus: number
  vitaminA: number
  vitaminC: number
  vitaminD: number
  vitaminB12: number
  mealCount: number
}
