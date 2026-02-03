import { PrismaClient } from '@prisma/client'
import { config } from '../config/env.js'

const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
})

if (config.isDev) {
  globalForPrisma.prisma = prisma
}

export async function connectPrisma() {
  try {
    await prisma.$connect()
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Failed to connect to database:', error)
    process.exit(1)
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect()
  console.log('Database disconnected')
}
