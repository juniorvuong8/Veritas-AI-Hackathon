import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { validLesson } from '@shared/test-fixtures.ts'
import { QuizScreen } from './QuizScreen'

async function answer(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('button', { name: option }))
}

describe('QuizScreen', () => {
  it('scores the quiz and lets you retry or start a new conversation', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    render(<QuizScreen quiz={validLesson().quiz} onNewConversation={onNew} />)

    expect(screen.getByText('Câu 1 / 3')).toBeInTheDocument()
    await answer(user, 'menu') // right
    expect(screen.getByText('Đúng rồi!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'receipt' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    await answer(user, 'menu') // wrong (answer: to go)
    expect(screen.getByText('Chưa đúng.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    await answer(user, 'receipt') // right
    await user.click(screen.getByRole('button', { name: 'Xem kết quả' }))

    expect(screen.getByText('Bạn trả lời đúng 2/3 câu')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(screen.getByText('Câu 1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'menu' })).toBeEnabled()

    for (const o of ['menu', 'to go', 'receipt']) {
      await answer(user, o)
      await user.click(screen.getByRole('button', { name: /Câu tiếp theo|Xem kết quả/ }))
    }
    await user.click(screen.getByRole('button', { name: 'Hội thoại mới' }))
    expect(onNew).toHaveBeenCalled()
  })
})
