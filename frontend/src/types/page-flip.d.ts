declare module 'page-flip' {
  export type PageFlipEvent = {
    data: number | string | { page: number; mode: 'portrait' | 'landscape' }
    object: PageFlip
  }

  export type PageFlipSettings = {
    startPage: number
    size: 'fixed' | 'stretch'
    width: number
    height: number
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
    drawShadow: boolean
    flippingTime: number
    usePortrait: boolean
    startZIndex: number
    autoSize: boolean
    maxShadowOpacity: number
    showCover: boolean
    mobileScrollSupport: boolean
    clickEventForward: boolean
    useMouseEvents: boolean
    swipeDistance: number
    showPageCorners: boolean
    disableFlipByClick: boolean
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<PageFlipSettings>)
    on(eventName: string, callback: (event: PageFlipEvent) => void): PageFlip
    off(eventName: string): void
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    turnToPage(page: number): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getOrientation(): 'portrait' | 'landscape'
    destroy(): void
  }
}
