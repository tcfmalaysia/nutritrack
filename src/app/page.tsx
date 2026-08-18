'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import {
  Camera, Upload, Plus, Trash2, ChevronLeft, ChevronRight,
  Flame, Beef, Wheat, Droplets, Apple, TrendingUp,
  Calendar, BarChart3, Utensils, X, Check,
  Loader2, Target, PieChart, Salad, Cookie,
  Coffee, Sandwich, Pencil, Save, Download, UploadCloud,
  ShieldCheck, ShieldAlert, ShieldQuestion
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, Legend
} from 'recharts'
import {
  getMeals, addMeal, updateMeal, deleteMeal as deleteMealLocal,
  getGoal, setGoal as setGoalLocal,
  getMealsInRange, exportAllData, importAllData
} from '@/lib/local-db'
import type { MealEntry, DailyGoal, NutritionData, DailyTotal } from '@/lib/types'

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500' },
  { value: 'lunch', label: 'Lunch', icon: Salad, color: 'text-green-500' },
  { value: 'dinner', label: 'Dinner', icon: Sandwich, color: 'text-orange-500' },
  { value: 'snack', label: 'Snack', icon: Cookie, color: 'text-purple-500' },
]

const defaultGoal: Omit<DailyGoal, 'date'> = { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 }

function ConfidenceBadge({ level }: { level: string }) {
  if (level === 'high') return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0"><ShieldCheck className="w-3 h-3 mr-1" />High</Badge>
  if (level === 'low') return <Badge variant="destructive" className="text-xs"><ShieldAlert className="w-3 h-3 mr-1" />Low</Badge>
  return <Badge variant="secondary" className="text-xs"><ShieldQuestion className="w-3 h-3 mr-1" />Medium</Badge>
}

function EditableRow({ label, value, onChange, unit, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; unit: string; step?: number
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(value))
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <Label className="text-xs min-w-[80px]">{label}</Label>
        <Input type="number" step={step} value={editVal} onChange={(e) => setEditVal(e.target.value)} className="h-7 text-xs w-20" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(Number(editVal) || 0); setEditing(false) }; if (e.key === 'Escape') setEditing(false) }}
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { onChange(Number(editVal) || 0); setEditing(false) }}><Check className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}><X className="w-3 h-3" /></Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/50 rounded px-1 group" onClick={() => { setEditVal(String(value)); setEditing(true) }}>
      <Label className="text-xs min-w-[80px]">{label}</Label>
      <span className="text-xs font-medium">{value.toFixed(step < 1 ? 1 : 0)}</span>
      <span className="text-xs text-muted-foreground">{unit}</span>
      <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('log')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [mealType, setMealType] = useState('lunch')
  const [description, setDescription] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzedData, setAnalyzedData] = useState<NutritionData | null>(null)
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [isLoadingMeals, setIsLoadingMeals] = useState(false)
  const [analyticsRange, setAnalyticsRange] = useState('week')
  const [analyticsData, setAnalyticsData] = useState<DailyTotal[]>([])
  const [analyticsSummary, setAnalyticsSummary] = useState({ avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, daysTracked: 0, totalDays: 7 })
  const [goal, setGoal] = useState(defaultGoal)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [goalForm, setGoalForm] = useState(defaultGoal)
  const [showCamera, setShowCamera] = useState(false)
  const [showMinerals, setShowMinerals] = useState(false)
  const [editingMeal, setEditingMeal] = useState<string | null>(null)
  const [showDataDialog, setShowDataDialog] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Fetch meals from IndexedDB
  const fetchMeals = useCallback(async () => {
    setIsLoadingMeals(true)
    try {
      const data = await getMeals(selectedDate)
      setMeals(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch meals', variant: 'destructive' })
    } finally {
      setIsLoadingMeals(false)
    }
  }, [selectedDate])

  // Fetch goals from IndexedDB
  const fetchGoals = useCallback(async () => {
    try {
      const g = await getGoal(selectedDate)
      if (g) {
        const { date: _, ...rest } = g
        setGoal(rest); setGoalForm(rest)
      }
    } catch { /* defaults */ }
  }, [selectedDate])

  // Fetch analytics from IndexedDB
  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true)
    try {
      const endDate = new Date(selectedDate)
      let startDate = new Date(selectedDate)
      let numDays = 7
      switch (analyticsRange) {
        case 'month': startDate.setMonth(startDate.getMonth() - 1); numDays = 30; break
        case '3months': startDate.setMonth(startDate.getMonth() - 3); numDays = 90; break
        default: startDate.setDate(startDate.getDate() - 6); numDays = 7
      }
      const fromStr = startDate.toISOString().split('T')[0]
      const toStr = endDate.toISOString().split('T')[0]
      const allMeals = await getMealsInRange(fromStr, toStr)

      // Group by date
      const dailyMap: Record<string, DailyTotal> = {}
      for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const key = d.toISOString().split('T')[0]
        dailyMap[key] = { date: key, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, calcium: 0, iron: 0, magnesium: 0, potassium: 0, zinc: 0, phosphorus: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, mealCount: 0 }
      }
      for (const meal of allMeals) {
        if (dailyMap[meal.date]) {
          const d = dailyMap[meal.date]
          d.calories += meal.calories; d.protein += meal.protein; d.carbs += meal.carbs; d.fat += meal.fat
          d.fiber += meal.fiber; d.sugar += meal.sugar; d.sodium += meal.sodium
          d.calcium += meal.calcium; d.iron += meal.iron; d.magnesium += meal.magnesium; d.potassium += meal.potassium
          d.zinc += meal.zinc; d.phosphorus += meal.phosphorus
          d.vitaminA += meal.vitaminA; d.vitaminC += meal.vitaminC; d.vitaminD += meal.vitaminD; d.vitaminB12 += meal.vitaminB12
          d.mealCount++
        }
      }
      const dailyArr = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
      setAnalyticsData(dailyArr)

      const tracked = dailyArr.filter((d) => d.mealCount > 0)
      setAnalyticsSummary({
        avgCalories: tracked.length ? Math.round(tracked.reduce((s, d) => s + d.calories, 0) / tracked.length) : 0,
        avgProtein: tracked.length ? tracked.reduce((s, d) => s + d.protein, 0) / tracked.length : 0,
        avgCarbs: tracked.length ? tracked.reduce((s, d) => s + d.carbs, 0) / tracked.length : 0,
        avgFat: tracked.length ? tracked.reduce((s, d) => s + d.fat, 0) / tracked.length : 0,
        daysTracked: tracked.length,
        totalDays: numDays,
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch analytics', variant: 'destructive' })
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [analyticsRange, selectedDate])

  useEffect(() => { fetchMeals(); fetchGoals() }, [fetchMeals, fetchGoals])
  useEffect(() => { if (activeTab === 'analytics') fetchAnalytics() }, [activeTab, fetchAnalytics])

  // Daily totals
  const dailyTotals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber, sugar: acc.sugar + m.sugar, sodium: acc.sodium + m.sodium,
      calcium: acc.calcium + m.calcium, iron: acc.iron + m.iron, magnesium: acc.magnesium + m.magnesium, potassium: acc.potassium + m.potassium,
      zinc: acc.zinc + m.zinc, phosphorus: acc.phosphorus + m.phosphorus,
      vitaminA: acc.vitaminA + m.vitaminA, vitaminC: acc.vitaminC + m.vitaminC, vitaminD: acc.vitaminD + m.vitaminD, vitaminB12: acc.vitaminB12 + m.vitaminB12,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, calcium: 0, iron: 0, magnesium: 0, potassium: 0, zinc: 0, phosphorus: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0 }
  )

  // File upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { const result = reader.result as string; setImagePreview(result); setImageBase64(result) }
    reader.readAsDataURL(file)
  }

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }; setShowCamera(true)
    } catch { toast({ title: 'Camera Error', description: 'Could not access camera.', variant: 'destructive' }) }
  }
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current; const video = videoRef.current; canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8); setImagePreview(dataUrl); setImageBase64(dataUrl); stopCamera()
  }
  const stopCamera = () => { if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }; setShowCamera(false) }

  // Analyze food (API only)
  const analyzeFood = async () => {
    if (!imageBase64 && !description.trim()) { toast({ title: 'Input Required', description: 'Provide a photo or description', variant: 'destructive' }); return }
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-food', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 || undefined, description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (data.success && data.data) { setAnalyzedData(data.data); toast({ title: 'Analysis Complete', description: `Identified: ${data.data.foodName}` }) }
      else { toast({ title: 'Analysis Failed', description: data.error || 'Could not analyze', variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to analyze food', variant: 'destructive' }) }
    finally { setIsAnalyzing(false) }
  }

  // Save meal to IndexedDB
  const saveMeal = async (data?: NutritionData) => {
    const saveData = data || analyzedData; if (!saveData) return
    try {
      await addMeal({
        date: selectedDate, mealType, foodName: saveData.foodName, description: description || undefined,
        imageUrl: undefined,
        calories: saveData.calories, protein: saveData.protein, carbs: saveData.carbs, fat: saveData.fat,
        fiber: saveData.fiber, sugar: saveData.sugar, sodium: saveData.sodium,
        calcium: saveData.calcium, iron: saveData.iron, magnesium: saveData.magnesium,
        potassium: saveData.potassium, zinc: saveData.zinc, phosphorus: saveData.phosphorus,
        vitaminA: saveData.vitaminA, vitaminC: saveData.vitaminC, vitaminD: saveData.vitaminD, vitaminB12: saveData.vitaminB12,
        servingSize: saveData.servingSize, confidence: saveData.confidence, aiNotes: saveData.notes,
      })
      toast({ title: 'Saved!', description: `${saveData.foodName} added to ${mealType}` })
      resetForm(); fetchMeals()
    } catch { toast({ title: 'Error', description: 'Failed to save meal', variant: 'destructive' }) }
  }

  // Delete meal
  const deleteMeal = async (id: string) => {
    try { await deleteMealLocal(id); toast({ title: 'Deleted', description: 'Meal entry removed' }); fetchMeals() }
    catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }) }
  }

  // Update meal field
  const updateMealField = async (id: string, field: string, value: number) => {
    try { await updateMeal(id, { [field]: value } as Partial<MealEntry>); fetchMeals() }
    catch { toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }) }
  }

  // Save goals to IndexedDB
  const saveGoals = async () => {
    try { await setGoalLocal({ date: selectedDate, ...goalForm }); setGoal(goalForm); setShowGoalDialog(false); toast({ title: 'Goals Updated', description: 'Saved to your device' }) }
    catch { toast({ title: 'Error', description: 'Failed to save goals', variant: 'destructive' }) }
  }

  // Export data
  const handleExport = async () => {
    try {
      const json = await exportAllData()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `nutritrack-backup-${format(new Date(), 'yyyy-MM-dd')}.json`; a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Exported!', description: 'Backup file downloaded' })
    } catch { toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' }) }
  }

  // Import data
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const text = await file.text()
      const result = await importAllData(text)
      toast({ title: 'Imported!', description: `${result.meals} meals and ${result.goals} goals restored` })
      fetchMeals(); setShowDataDialog(false)
    } catch { toast({ title: 'Import Error', description: 'Invalid backup file', variant: 'destructive' }) }
  }

  const resetForm = () => { setDescription(''); setImagePreview(null); setImageBase64(null); setAnalyzedData(null) }
  const navigateDate = (d: number) => setSelectedDate(format(addDays(new Date(selectedDate), d), 'yyyy-MM-dd'))
  const formatChartDate = (s: string) => format(new Date(s + 'T00:00:00'), 'MMM d')
  const mealsByType = MEAL_TYPES.map((mt) => ({ ...mt, meals: meals.filter((m) => m.mealType === mt.value) }))
  const chartData = analyticsData.map((d) => ({ date: formatChartDate(d.date), calories: Math.round(d.calories), protein: Math.round(d.protein * 10) / 10, carbs: Math.round(d.carbs * 10) / 10, fat: Math.round(d.fat * 10) / 10 }))

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Apple className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">NutriTrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs"><Calendar className="w-3 h-3 mr-1" />{format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')}</Badge>
            <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><Target className="w-3.5 h-3.5" /> Goals</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Daily Nutrition Goals</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {[{ label: 'Calories (kcal)', key: 'calories' as const }, { label: 'Protein (g)', key: 'protein' as const }, { label: 'Carbs (g)', key: 'carbs' as const }, { label: 'Fat (g)', key: 'fat' as const }, { label: 'Fiber (g)', key: 'fiber' as const }].map((i) => (
                    <div key={i.key}><Label>{i.label}</Label><Input type="number" value={goalForm[i.key]} onChange={(e) => setGoalForm({ ...goalForm, [i.key]: Number(e.target.value) })} /></div>
                  ))}
                </div>
                <Button onClick={saveGoals} className="mt-4 w-full">Save Goals</Button>
              </DialogContent>
            </Dialog>
            <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><Save className="w-3.5 h-3.5" /> Data</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Data Backup & Transfer</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-sm">
                    <p className="font-semibold mb-1">Your data is stored on this device</p>
                    <p className="text-muted-foreground text-xs">Meals and goals are saved in your browser&apos;s local storage. To keep data across devices, use export/import below.</p>
                  </div>
                  <div className="space-y-2">
                    <Button onClick={handleExport} className="w-full gap-2"><Download className="w-4 h-4" /> Export Backup File</Button>
                    <Button variant="outline" onClick={() => importInputRef.current?.click()} className="w-full gap-2"><UploadCloud className="w-4 h-4" /> Import Backup File</Button>
                    <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                  </div>
                  <Separator />
                  <div className="text-xs text-muted-foreground">
                    <p><strong>How to transfer to another device:</strong></p>
                    <ol className="list-decimal ml-4 space-y-1 mt-1">
                      <li>Tap &ldquo;Export Backup File&rdquo; on this device</li>
                      <li>Send the downloaded .json file to yourself (email, WhatsApp, etc.)</li>
                      <li>Open NutriTrack on the other device</li>
                      <li>Tap Data → &ldquo;Import Backup File&rdquo; and select the file</li>
                    </ol>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Date Navigation */}
      <div className="max-w-4xl mx-auto w-full px-4 py-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="flex items-center gap-2">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto text-center text-sm" />
          {selectedDate !== format(new Date(), 'yyyy-MM-dd') && <Button variant="ghost" size="sm" onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>Today</Button>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {/* Daily Summary */}
      <div className="max-w-4xl mx-auto w-full px-4 pb-2">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-3">
              {[{ label: 'Calories', value: Math.round(dailyTotals.calories), max: goal.calories, unit: 'kcal', icon: Flame, color: 'text-red-500' }, { label: 'Protein', value: Math.round(dailyTotals.protein * 10) / 10, max: goal.protein, unit: 'g', icon: Beef, color: 'text-amber-600' }, { label: 'Carbs', value: Math.round(dailyTotals.carbs * 10) / 10, max: goal.carbs, unit: 'g', icon: Wheat, color: 'text-green-600' }, { label: 'Fat', value: Math.round(dailyTotals.fat * 10) / 10, max: goal.fat, unit: 'g', icon: Droplets, color: 'text-blue-500' }].map((item) => (
                <div key={item.label} className="text-center">
                  <div className={`flex items-center justify-center gap-1 mb-1 ${item.color}`}><item.icon className="w-3.5 h-3.5" /><span className="text-xs font-medium">{item.label}</span></div>
                  <div className="text-lg font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">/ {item.max} {item.unit}</div>
                  <Progress value={Math.min((item.value / item.max) * 100, 100)} className="h-1.5 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="log" className="gap-1.5"><Plus className="w-4 h-4" /> Log Food</TabsTrigger>
            <TabsTrigger value="diary" className="gap-1.5"><Utensils className="w-4 h-4" /> Diary</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
          </TabsList>

          {/* LOG FOOD */}
          <TabsContent value="log" className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4 text-emerald-500" /> Add Food</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm mb-2 block">Meal Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((mt) => (
                      <Button key={mt.value} variant={mealType === mt.value ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setMealType(mt.value)}>
                        <mt.icon className={`w-3.5 h-3.5 ${mealType !== mt.value ? mt.color : ''}`} />{mt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Food Photo</Label>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => cameraInputRef.current?.click()}><Camera className="w-4 h-4" /> Take Photo</Button>
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" /> Upload</Button>
                    {imagePreview && <Button variant="ghost" size="sm" onClick={() => { setImagePreview(null); setImageBase64(null) }}><X className="w-4 h-4" /></Button>}
                  </div>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  {imagePreview && <div className="relative rounded-lg overflow-hidden border"><img src={imagePreview} alt="Food preview" className="w-full max-h-48 object-cover" /></div>}
                  {showCamera && (
                    <div className="relative rounded-lg overflow-hidden border">
                      <video ref={videoRef} className="w-full" autoPlay playsInline muted /><canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                        <Button size="sm" onClick={capturePhoto} className="gap-1"><Camera className="w-4 h-4" /> Capture</Button>
                        <Button size="sm" variant="outline" onClick={stopCamera}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Or describe your food</Label>
                  <Textarea placeholder='Be specific: e.g. "200g grilled salmon with 1 cup brown rice and steamed asparagus"' value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">Include portion size, cooking method & ingredients for higher accuracy</p>
                </div>
                <Button onClick={analyzeFood} disabled={isAnalyzing || (!imageBase64 && !description.trim())} className="w-full gap-2" size="lg">
                  {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with AI...</> : <><Flame className="w-4 h-4" /> Analyze Nutrition</>}
                </Button>
              </CardContent>
            </Card>

            {/* Analysis Result */}
            {analyzedData && (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" />
                      <Input value={analyzedData.foodName} onChange={(e) => setAnalyzedData({ ...analyzedData, foodName: e.target.value })} className="h-7 text-sm font-semibold border-0 p-0 focus-visible:ring-0" />
                    </span>
                    <ConfidenceBadge level={analyzedData.confidence} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analyzedData.servingSize && (
                    <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground">Serving:</Label>
                      <Input value={analyzedData.servingSize} onChange={(e) => setAnalyzedData({ ...analyzedData, servingSize: e.target.value })} className="h-6 text-xs border-0 p-0 focus-visible:ring-0" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[{ key: 'calories' as const, label: 'Calories', unit: 'kcal', icon: Flame, bg: 'bg-red-50 dark:bg-red-950/30', ic: 'text-red-500' }, { key: 'protein' as const, label: 'Protein', unit: 'g', icon: Beef, bg: 'bg-amber-50 dark:bg-amber-950/30', ic: 'text-amber-600' }, { key: 'carbs' as const, label: 'Carbs', unit: 'g', icon: Wheat, bg: 'bg-green-50 dark:bg-green-950/30', ic: 'text-green-600' }, { key: 'fat' as const, label: 'Fat', unit: 'g', icon: Droplets, bg: 'bg-blue-50 dark:bg-blue-950/30', ic: 'text-blue-500' }].map((item) => (
                      <div key={item.key} className={`${item.bg} rounded-lg p-3 text-center`}>
                        <item.icon className={`w-5 h-5 ${item.ic} mx-auto mb-1`} />
                        <Input type="number" step={item.key === 'calories' ? 1 : 0.1} value={analyzedData[item.key]} onChange={(e) => setAnalyzedData({ ...analyzedData, [item.key]: Number(e.target.value) || 0 })} className="h-7 text-lg font-bold text-center border-0 p-0 focus-visible:ring-0 w-full" />
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <EditableRow label="Fiber" value={analyzedData.fiber} unit="g" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, fiber: v })} />
                    <EditableRow label="Sugar" value={analyzedData.sugar} unit="g" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, sugar: v })} />
                    <EditableRow label="Sodium" value={analyzedData.sodium} unit="mg" onChange={(v) => setAnalyzedData({ ...analyzedData, sodium: v })} />
                  </div>
                  <div>
                    <Button variant="ghost" size="sm" className="w-full gap-1 text-xs" onClick={() => setShowMinerals(!showMinerals)}>
                      {showMinerals ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}{showMinerals ? 'Hide' : 'Show'} Minerals & Vitamins
                    </Button>
                    {showMinerals && (
                      <div className="mt-2 space-y-0.5 border rounded-lg p-3 bg-muted/30">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Minerals</p>
                        <div className="grid grid-cols-2 gap-x-4">
                          <EditableRow label="Calcium" value={analyzedData.calcium} unit="mg" onChange={(v) => setAnalyzedData({ ...analyzedData, calcium: v })} />
                          <EditableRow label="Iron" value={analyzedData.iron} unit="mg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, iron: v })} />
                          <EditableRow label="Magnesium" value={analyzedData.magnesium} unit="mg" onChange={(v) => setAnalyzedData({ ...analyzedData, magnesium: v })} />
                          <EditableRow label="Potassium" value={analyzedData.potassium} unit="mg" onChange={(v) => setAnalyzedData({ ...analyzedData, potassium: v })} />
                          <EditableRow label="Zinc" value={analyzedData.zinc} unit="mg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, zinc: v })} />
                          <EditableRow label="Phosphorus" value={analyzedData.phosphorus} unit="mg" onChange={(v) => setAnalyzedData({ ...analyzedData, phosphorus: v })} />
                        </div>
                        <Separator className="my-2" />
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Vitamins</p>
                        <div className="grid grid-cols-2 gap-x-4">
                          <EditableRow label="Vitamin A" value={analyzedData.vitaminA} unit="mcg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, vitaminA: v })} />
                          <EditableRow label="Vitamin C" value={analyzedData.vitaminC} unit="mg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, vitaminC: v })} />
                          <EditableRow label="Vitamin D" value={analyzedData.vitaminD} unit="mcg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, vitaminD: v })} />
                          <EditableRow label="Vitamin B12" value={analyzedData.vitaminB12} unit="mcg" step={0.1} onChange={(v) => setAnalyzedData({ ...analyzedData, vitaminB12: v })} />
                        </div>
                      </div>
                    )}
                  </div>
                  {analyzedData.notes && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 text-xs text-amber-800 dark:text-amber-200">
                      <span className="font-semibold">AI Reasoning:</span> {analyzedData.notes}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={() => saveMeal()} className="flex-1 gap-2"><Check className="w-4 h-4" /> Add to {mealType}</Button>
                    <Button variant="outline" onClick={resetForm} className="gap-2"><X className="w-4 h-4" /> Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DIARY */}
          <TabsContent value="diary" className="space-y-4">
            {isLoadingMeals ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            : meals.length === 0 ? (
              <Card className="py-12"><CardContent className="text-center text-muted-foreground"><Utensils className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-lg font-medium">No meals logged</p><p className="text-sm">Switch to &ldquo;Log Food&rdquo; to add your first meal</p></CardContent></Card>
            ) : (
              <>
                {mealsByType.filter((mt) => mt.meals.length > 0).map((mt) => (
                  <Card key={mt.value}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><mt.icon className={`w-4 h-4 ${mt.color}`} /> {mt.label}<Badge variant="secondary" className="text-xs ml-auto">{mt.meals.reduce((s, m) => s + m.calories, 0).toFixed(0)} kcal</Badge></CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {mt.meals.map((meal) => (
                        <div key={meal.id} className="rounded-lg border p-2 group hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm flex items-center gap-2">{meal.foodName}<ConfidenceBadge level={meal.confidence} /></div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                <span>{Math.round(meal.calories)} kcal</span><span>P: {meal.protein.toFixed(1)}g</span><span>C: {meal.carbs.toFixed(1)}g</span><span>F: {meal.fat.toFixed(1)}g</span>
                              </div>
                              {meal.servingSize && <div className="text-xs text-muted-foreground mt-0.5">{meal.servingSize}</div>}
                              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                                {meal.calcium > 0 && <span>Ca: {Math.round(meal.calcium)}mg</span>}
                                {meal.iron > 0 && <span>Fe: {meal.iron.toFixed(1)}mg</span>}
                                {meal.magnesium > 0 && <span>Mg: {Math.round(meal.magnesium)}mg</span>}
                                {meal.potassium > 0 && <span>K: {Math.round(meal.potassium)}mg</span>}
                                {meal.vitaminC > 0 && <span>VitC: {meal.vitaminC.toFixed(1)}mg</span>}
                              </div>
                              {meal.aiNotes && <p className="text-xs text-muted-foreground italic mt-1 truncate">{meal.aiNotes}</p>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMeal(editingMeal === meal.id ? null : meal.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMeal(meal.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                          {editingMeal === meal.id && (
                            <div className="mt-2 border-t pt-2 space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">Edit values:</p>
                              <div className="grid grid-cols-2 gap-x-4">
                                <EditableRow label="Calories" value={meal.calories} unit="kcal" onChange={(v) => updateMealField(meal.id, 'calories', v)} />
                                <EditableRow label="Protein" value={meal.protein} unit="g" step={0.1} onChange={(v) => updateMealField(meal.id, 'protein', v)} />
                                <EditableRow label="Carbs" value={meal.carbs} unit="g" step={0.1} onChange={(v) => updateMealField(meal.id, 'carbs', v)} />
                                <EditableRow label="Fat" value={meal.fat} unit="g" step={0.1} onChange={(v) => updateMealField(meal.id, 'fat', v)} />
                                <EditableRow label="Fiber" value={meal.fiber} unit="g" step={0.1} onChange={(v) => updateMealField(meal.id, 'fiber', v)} />
                                <EditableRow label="Sodium" value={meal.sodium} unit="mg" onChange={(v) => updateMealField(meal.id, 'sodium', v)} />
                                <EditableRow label="Calcium" value={meal.calcium} unit="mg" onChange={(v) => updateMealField(meal.id, 'calcium', v)} />
                                <EditableRow label="Iron" value={meal.iron} unit="mg" step={0.1} onChange={(v) => updateMealField(meal.id, 'iron', v)} />
                                <EditableRow label="Magnesium" value={meal.magnesium} unit="mg" onChange={(v) => updateMealField(meal.id, 'magnesium', v)} />
                                <EditableRow label="Potassium" value={meal.potassium} unit="mg" onChange={(v) => updateMealField(meal.id, 'potassium', v)} />
                                <EditableRow label="Zinc" value={meal.zinc} unit="mg" step={0.1} onChange={(v) => updateMealField(meal.id, 'zinc', v)} />
                                <EditableRow label="Vit C" value={meal.vitaminC} unit="mg" step={0.1} onChange={(v) => updateMealField(meal.id, 'vitaminC', v)} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Daily Total</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div><div className="text-2xl font-bold">{Math.round(dailyTotals.calories)}</div><div className="text-xs text-muted-foreground">Calories</div><Progress value={Math.min((dailyTotals.calories / goal.calories) * 100, 100)} className="h-1 mt-1" /></div>
                      <div><div className="text-2xl font-bold">{dailyTotals.protein.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Protein</div><Progress value={Math.min((dailyTotals.protein / goal.protein) * 100, 100)} className="h-1 mt-1" /></div>
                      <div><div className="text-2xl font-bold">{dailyTotals.carbs.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Carbs</div><Progress value={Math.min((dailyTotals.carbs / goal.carbs) * 100, 100)} className="h-1 mt-1" /></div>
                      <div><div className="text-2xl font-bold">{dailyTotals.fat.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Fat</div><Progress value={Math.min((dailyTotals.fat / goal.fat) * 100, 100)} className="h-1 mt-1" /></div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground text-center">
                      <div>Fiber: {dailyTotals.fiber.toFixed(1)}g</div><div>Sugar: {dailyTotals.sugar.toFixed(1)}g</div><div>Sodium: {Math.round(dailyTotals.sodium)}mg</div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted-foreground text-center">
                      <div>Ca: {Math.round(dailyTotals.calcium)}mg</div><div>Fe: {dailyTotals.iron.toFixed(1)}mg</div><div>Mg: {Math.round(dailyTotals.magnesium)}mg</div><div>K: {Math.round(dailyTotals.potassium)}mg</div>
                      <div>Zn: {dailyTotals.zinc.toFixed(1)}mg</div><div>P: {Math.round(dailyTotals.phosphorus)}mg</div><div>VitC: {dailyTotals.vitaminC.toFixed(1)}mg</div><div>B12: {dailyTotals.vitaminB12.toFixed(1)}mcg</div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="flex gap-2">
              {[{ value: 'week', label: '7 Days' }, { value: 'month', label: '30 Days' }, { value: '3months', label: '3 Months' }].map((r) => (
                <Button key={r.value} variant={analyticsRange === r.value ? 'default' : 'outline'} size="sm" onClick={() => setAnalyticsRange(r.value)}>{r.label}</Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-3 text-center"><Flame className="w-4 h-4 text-red-500 mx-auto mb-1" /><div className="text-xl font-bold">{analyticsSummary.avgCalories}</div><div className="text-xs text-muted-foreground">Avg Calories</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><Beef className="w-4 h-4 text-amber-600 mx-auto mb-1" /><div className="text-xl font-bold">{analyticsSummary.avgProtein.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Avg Protein</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><Wheat className="w-4 h-4 text-green-600 mx-auto mb-1" /><div className="text-xl font-bold">{analyticsSummary.avgCarbs.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Avg Carbs</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><Droplets className="w-4 h-4 text-blue-500 mx-auto mb-1" /><div className="text-xl font-bold">{analyticsSummary.avgFat.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Avg Fat</div></CardContent></Card>
            </div>
            <Card className="text-sm text-muted-foreground"><CardContent className="p-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Tracked {analyticsSummary.daysTracked} of {analyticsSummary.totalDays} days</CardContent></Card>
            {isLoadingAnalytics ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            : chartData.length > 0 && chartData.some((d) => d.calories > 0) ? (
              <>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" /> Calories Over Time</CardTitle></CardHeader>
                  <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Area type="monotone" dataKey="calories" stroke="hsl(0,72%,51%)" fill="url(#cg)" strokeWidth={2} name="Calories" /></AreaChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4 text-emerald-500" /> Macronutrients Trend</CardTitle></CardHeader>
                  <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Legend /><Line type="monotone" dataKey="protein" stroke="hsl(25,95%,53%)" strokeWidth={2} dot={false} name="Protein (g)" /><Line type="monotone" dataKey="carbs" stroke="hsl(142,71%,45%)" strokeWidth={2} dot={false} name="Carbs (g)" /><Line type="monotone" dataKey="fat" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} name="Fat (g)" /></LineChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-500" /> Daily Calorie Breakdown</CardTitle></CardHeader>
                  <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Bar dataKey="calories" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} name="Calories" /></BarChart></ResponsiveContainer></div></CardContent>
                </Card>
              </>
            ) : (
              <Card className="py-12"><CardContent className="text-center text-muted-foreground"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-lg font-medium">No data yet</p><p className="text-sm">Start logging meals to see your trends</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          NutriTrack — Data saved on your device • Tap Data to backup/transfer
        </div>
      </footer>
    </div>
  )
}
