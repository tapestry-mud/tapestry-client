export function stripMarkup(text: string): string {
    let result = text.replace(/\x1b\[[0-9;]*m/g, '')
    result = result.replace(/\[[0-9;]+m/g, '')
    result = result.replace(/\{[a-zA-Z0-9_]+\}/g, '')
    let prev = ''
    while (prev !== result) {
        prev = result
        result = result.replace(/<[^>]+>/g, '')
    }
    return result
}
