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
    
    // 讀取檔案（從專案根目錄的 help 目錄）
    // process.cwd() 在 Next.js API route 中會返回專案根目錄
    const filePath = join(process.cwd(), 'help', locale, `${file}.md`)
    
    try {
      const content = await readFile(filePath, 'utf-8')
      
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    } catch (error) {
      console.error(`[Help API] File not found: ${filePath}`, error)
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('[Help API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
