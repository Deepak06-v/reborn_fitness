import { Schema, model, models, type Model } from 'mongoose'

interface CounterDoc {
  _id: string
  seq: number
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

export const Counter = (models.Counter as Model<CounterDoc>) ?? model<CounterDoc>('Counter', counterSchema)

/** Atomically increments and returns the next value for a named sequence. */
export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return counter.seq
}
