import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const id = '611ca8cd-b090-415e-bb95-4bffbc001410'
  console.log(`Checking brand with ID: ${id}`)
  
  try {
    const brand = await prisma.brand.findUnique({
      where: { id }
    })
    
    if (brand) {
      console.log('Brand found:', JSON.stringify(brand, null, 2))
    } else {
      console.log('Brand NOT found.')
    }
    
    // Check if there are other brands with same unique fields? 
    // Usually name/slug are unique.
  } catch (err) {
    console.error('Error during lookup:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
