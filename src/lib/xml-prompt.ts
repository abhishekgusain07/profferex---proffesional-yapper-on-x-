/**
 * XmlPrompt class for building structured XML prompts for AI models
 * Provides a clean API for creating nested XML structures with attributes
 */
export class XmlPrompt {
  private content: string = ''
  private indentLevel: number = 0
  private readonly indentSize: number = 2

  /**
   * Get the current indentation string
   */
  private getIndent(): string {
    return ' '.repeat(this.indentLevel * this.indentSize)
  }

  /**
   * Add raw text content
   */
  text(content: string): this {
    this.content += content
    return this
  }

  /**
   * Add a line of text with proper indentation
   */
  line(content: string = ''): this {
    this.content += this.getIndent() + content + '\n'
    return this
  }

  /**
   * Open an XML tag with optional attributes
   */
  open(tagName: string, attributes: Record<string, string> = {}): this {
    let tag = `<${tagName}`
    
    // Add attributes if provided
    for (const [key, value] of Object.entries(attributes)) {
      tag += ` ${key}="${this.escapeXml(value)}"`
    }
    
    tag += '>'
    
    this.line(tag)
    this.indentLevel++
    return this
  }

  /**
   * Close an XML tag
   */
  close(tagName: string): this {
    this.indentLevel--
    this.line(`</${tagName}>`)
    return this
  }

  /**
   * Add a self-closing tag with content and optional attributes
   */
  tag(tagName: string, content: string, attributes: Record<string, string> = {}): this {
    let tag = `<${tagName}`
    
    // Add attributes if provided
    for (const [key, value] of Object.entries(attributes)) {
      tag += ` ${key}="${this.escapeXml(value)}"`
    }
    
    tag += `>${this.escapeXml(content)}</${tagName}>`
    
    this.line(tag)
    return this
  }

  /**
   * Add a comment
   */
  comment(content: string): this {
    this.line(`<!-- ${content} -->`)
    return this
  }

  /**
   * Add a blank line
   */
  blank(): this {
    this.content += '\n'
    return this
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Add raw content without indentation
   */
  raw(content: string): this {
    this.content += content
    return this
  }

  /**
   * Get the final XML string
   */
  toString(): string {
    return this.content.trim()
  }

  /**
   * Clear the prompt content
   */
  clear(): this {
    this.content = ''
    this.indentLevel = 0
    return this
  }

  /**
   * Get the current length of the prompt
   */
  length(): number {
    return this.content.length
  }

  /**
   * Check if the prompt is empty
   */
  isEmpty(): boolean {
    return this.content.trim().length === 0
  }

  /**
   * Create a new instance with the same content
   */
  clone(): XmlPrompt {
    const cloned = new XmlPrompt()
    cloned.content = this.content
    cloned.indentLevel = this.indentLevel
    return cloned
  }

  /**
   * Helper method to create a complete XML document structure
   */
  static create(): XmlPrompt {
    return new XmlPrompt()
  }

  /**
   * Add multiple tags with the same name but different content
   */
  list(tagName: string, items: string[], attributes: Record<string, string> = {}): this {
    for (const item of items) {
      this.tag(tagName, item, attributes)
    }
    return this
  }

  /**
   * Add a section with a title and content
   */
  section(title: string, content: string): this {
    this.open('section', { title })
    this.line(content)
    this.close('section')
    return this
  }

  /**
   * Add structured data as XML
   */
  data(tagName: string, data: Record<string, any>): this {
    this.open(tagName)
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        this.data(key, value)
      } else {
        this.tag(key, String(value))
      }
    }
    
    this.close(tagName)
    return this
  }

  /**
   * Wrap content in a tag
   */
  wrap(tagName: string, callback: (prompt: XmlPrompt) => void, attributes: Record<string, string> = {}): this {
    this.open(tagName, attributes)
    callback(this)
    this.close(tagName)
    return this
  }

  /**
   * Add conditional content
   */
  when(condition: boolean, callback: (prompt: XmlPrompt) => void): this {
    if (condition) {
      callback(this)
    }
    return this
  }

  /**
   * Add content from a template
   */
  template(template: string, variables: Record<string, string>): this {
    let content = template
    
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    
    this.raw(content)
    return this
  }
}