import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChooseScreen } from './ChooseScreen'

describe('ChooseScreen', () => {
  it('enables submit after picking café and 3 words, and submits the request', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChooseScreen onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /Quán cà phê/ }))
    const submit = screen.getByRole('button', { name: 'Tạo hội thoại' })
    expect(submit).toBeDisabled()
    for (const w of ['menu', 'to go', 'receipt']) await user.click(screen.getByRole('button', { name: w }))
    expect(submit).toBeEnabled()
    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith({ scenarioId: 'cafe', words: ['menu', 'to go', 'receipt'], level: 1 })
  })

  it('adds a Vietnamese custom word as a chip', async () => {
    const user = userEvent.setup()
    render(<ChooseScreen onSubmit={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Quán cà phê/ }))
    await user.type(screen.getByPlaceholderText(/Thêm từ của bạn/), 'hóa đơn')
    await user.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(screen.getByText('hóa đơn')).toBeInTheDocument()
    expect(screen.getByText(/Đã chọn 1\/5 từ/)).toBeInTheDocument()
  })
})

describe('ChooseScreen custom word rules', () => {
  it('refuses a word with digits and explains why', async () => {
    const user = userEvent.setup()
    render(<ChooseScreen onSubmit={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Quán cà phê/ }))
    await user.type(screen.getByPlaceholderText(/Thêm từ của bạn/), 'coffee2')
    await user.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(screen.queryByText('coffee2')).not.toBeInTheDocument()
    expect(screen.getByText(/chỉ được dùng chữ cái/)).toBeInTheDocument()
    expect(screen.getByText(/Đã chọn 0\/5 từ/)).toBeInTheDocument()
  })
})
