import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { locale: string; file: string } }
) {
  try {
    const { locale, file } = params
    
    // 驗證檔案名稱，防止路徑遍歷攻擊
    if (!/^[a-zA-Z0-9_-]+$/.test(file)) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      )
    }
    
    // 驗證 locale
    if (!['zh-TW', 'en'].includes(locale)) {
      return NextResponse.json(
        { error: 'Invalid locale' },
        { status: 400 }
      )
    }
    
    // 讀取 help 檔案
    // 不依賴 process.cwd()，因 Docker 與本地執行時 cwd 可能不同
    // - Docker/turbo: cwd = monorepo 根目錄 → apps/frontend/help
    // - 從 apps/frontend 執行: cwd = apps/frontend → help
    const possiblePaths = [
      join(process.cwd(), 'apps', 'frontend', 'help', locale, `${file}.md`),
      join(process.cwd(), 'help', locale, `${file}.md`),
    ]
    
    let content: string | null = null
    for (const filePath of possiblePaths) {
      try {
        content = await readFile(filePath, 'utf-8')
        break
      } catch {
        // 嘗試下一個路徑
      }
    }
    
    if (!content) {
      console.error(`[Help API] File not found. Tried: ${possiblePaths.join(', ')}`)
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('[Help API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
