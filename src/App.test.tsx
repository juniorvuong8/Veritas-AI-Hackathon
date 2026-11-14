import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validLesson } from '@shared/test-fixtures.ts'
import App from './App'
import { requestLesson } from '@/lib/api'

vi.mock('@/lib/api', () => ({ requestLesson: vi.fn() }))
const mocked = vi.mocked(requestLesson)

async function chooseAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Quán cà phê/ }))
  for (const w of ['menu', 'to go', 'receipt']) await user.click(screen.getByRole('button', { name: w }))
  await user.click(screen.getByRole('button', { name: 'Tạo hội thoại' }))
}

describe('App', () => {
  beforeEach(() => mocked.mockReset())

  it('goes from choosing to reading to the quiz', async () => {
    const user = userEvent.setup()
    let resolve!: (v: Awaited<ReturnType<typeof requestLesson>>) => void
    mocked.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<App />)
    await chooseAndSubmit(user)
    expect(screen.getByText('Đang tạo hội thoại…')).toBeInTheDocument()
    resolve({ ok: true, lesson: validLesson() })
    expect(await screen.findByText('Gọi đồ uống ở quán cà phê')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Làm bài kiểm tra' }))
    expect(screen.getByText('Câu 1 / 3')).toBeInTheDocument()
  })

  it('shows the error and offers the sample lesson', async () => {
    const user = userEvent.setup()
    mocked.mockResolvedValue({
      ok: false,
      code: 'out_of_credits',
      message_vi: 'Hệ thống tạm thời không tạo được hội thoại. Bạn có thể xem bài mẫu.',
    })
    render(<App />)
    await chooseAndSubmit(user)
    expect(await screen.findByText(/Hệ thống tạm thời không tạo được hội thoại/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem bài mẫu' }))
    expect(screen.getByText('Bài mẫu')).toBeInTheDocument()
  })

  it('retries with the same request', async () => {
    const user = userEvent.setup()
    mocked.mockResolvedValue({ ok: false, code: 'ai_failed', message_vi: 'Không tạo được hội thoại. Vui lòng thử lại.' })
    render(<App />)
    await chooseAndSubmit(user)
    await screen.findByText(/Không tạo được hội thoại/)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mocked).toHaveBeenCalledTimes(2)
    expect(mocked.mock.calls[1][0]).toEqual(mocked.mock.calls[0][0])
  })
})

describe('App bad request', () => {
  it('does not offer retry for a bad request', async () => {
    const user = userEvent.setup()
    mocked.mockReset()
    mocked.mockResolvedValue({ ok: false, code: 'bad_request', message_vi: 'Yêu cầu không hợp lệ. Vui lòng chọn lại từ vựng.' })
    render(<App />)
    await chooseAndSubmit(user)
    await screen.findByText(/Yêu cầu không hợp lệ/)
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chọn lại' })).toBeInTheDocument()
  })
})
