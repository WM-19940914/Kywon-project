/**
 * 연간 단가표 데이터를 Supabase DB에 임포트
 *
 * 실행 방법:
 *   npx tsx scripts/import-price-table.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { priceTable } from '../lib/price-table'

// .env.local 파일 로드
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function importPriceTable() {
  console.log('📊 단가표 데이터 임포트 시작...\n')

  let setsImported = 0
  let componentsImported = 0
  let errors = 0

  for (const row of priceTable) {
    try {
      // 1. SET 모델 삽입
      const { error: setError } = await supabase
        .from('price_table_sets')
        .upsert({
          model: row.model,
          category: row.category,
          size: row.size,
          price: row.price,
          year: 2026,
          is_active: true,
        }, {
          onConflict: 'model',
        })

      if (setError) {
        console.error(`❌ SET 모델 삽입 실패: ${row.model}`, setError.message)
        errors++
        continue
      }

      setsImported++
      console.log(`✅ SET: ${row.model} (${row.category} ${row.size})`)

      // 2. 구성품 삭제 후 재삽입 (중복 방지)
      await supabase
        .from('price_table_components')
        .delete()
        .eq('set_model', row.model)

      // 3. 구성품 삽입
      const components = row.components.map(comp => ({
        set_model: row.model,
        model: comp.model,
        type: comp.type,
        unit_price: comp.unitPrice,
        sale_price: comp.salePrice,
        quantity: comp.quantity,
      }))

      const { error: compError } = await supabase
        .from('price_table_components')
        .insert(components)

      if (compError) {
        console.error(`❌ 구성품 삽입 실패: ${row.model}`, compError.message)
        errors++
        continue
      }

      componentsImported += components.length
      console.log(`   └─ 구성품 ${components.length}개 삽입\n`)

    } catch (error) {
      console.error(`❌ 오류 발생:`, error)
      errors++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 임포트 완료!')
  console.log('='.repeat(50))
  console.log(`✅ SET 모델: ${setsImported}개`)
  console.log(`✅ 구성품: ${componentsImported}개`)
  if (errors > 0) {
    console.log(`❌ 오류: ${errors}개`)
  }
  console.log('='.repeat(50))
}

importPriceTable()
  .then(() => {
    console.log('\n✨ 완료!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 임포트 실패:', error)
    process.exit(1)
  })
