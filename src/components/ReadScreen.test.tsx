import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { validLesson } from '@shared/test-fixtures.ts'
import { ReadScreen } from './ReadScreen'

describe('ReadScreen', () => {
  it('renders the title and every speaker', () => {
    render(<ReadScreen lesson={validLesson()} onStartQuiz={vi.fn()} />)
    expect(screen.getByText('Gọi đồ uống ở quán cà phê')).toBeInTheDocument()
    expect(screen.getAllByText('Nhân viên:')).toHaveLength(2)
    expect(screen.getByText(/Cho em một ly cà phê sữa đá nhé\./)).toBeInTheDocument()
  })

  it('shows the Vietnamese → English mapping when vocab maps', () => {
    const lesson = validLesson()
    lesson.vocab[2] = { ...lesson.vocab[2], input: 'hóa đơn' }
    render(<ReadScreen lesson={lesson} onStartQuiz={vi.fn()} />)
    expect(screen.getByText('hóa đơn → receipt')).toBeInTheDocument()
  })

  it('shows the sample badge only for samples', () => {
    const { rerender } = render(<ReadScreen lesson={validLesson()} onStartQuiz={vi.fn()} />)
    expect(screen.queryByText('Bài mẫu')).not.toBeInTheDocument()
    rerender(<ReadScreen lesson={validLesson()} isSample onStartQuiz={vi.fn()} />)
    expect(screen.getByText('Bài mẫu')).toBeInTheDocument()
  })

  it('starts the quiz', async () => {
    const onStartQuiz = vi.fn()
    render(<ReadScreen lesson={validLesson()} onStartQuiz={onStartQuiz} />)
    await userEvent.click(screen.getByRole('button', { name: 'Làm bài kiểm tra' }))
    expect(onStartQuiz).toHaveBeenCalled()
  })
})
