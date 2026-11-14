import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the create-conversation button', () => {
    render(<App />)
    expect(screen.getByText('Tạo hội thoại')).toBeInTheDocument()
  })
})
