import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, {
  ssl: 'require',
  prepare: false
})

const db = drizzle(client)

async function disableRLS() {
  try {
    await db.execute(sql`ALTER TABLE "chats" DISABLE ROW LEVEL SECURITY`)
    console.log('RLS disabled on chats')
    await db.execute(sql`ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY`)
    console.log('RLS disabled on messages')
    await db.execute(sql`ALTER TABLE "parts" DISABLE ROW LEVEL SECURITY`)
    console.log('RLS disabled on parts')
    await db.execute(sql`ALTER TABLE "feedback" DISABLE ROW LEVEL SECURITY`)
    console.log('RLS disabled on feedback')
    console.log('All done!')
    await client.end()
    process.exit(0)
  } catch (e) {
    console.error('Error:', e)
    await client.end()
    process.exit(1)
  }
}

disableRLS()
