import mongoose from 'mongoose'
import { env } from './env'

mongoose.set('strictQuery', true)

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true,
  })
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
}

export { mongoose }
