import type { Result } from '@/shared/result/types'

export interface SendEmailParams {
  to: string
  subject: string
  template: string
  data?: Record<string, unknown>
}

export interface IEmailService {
  send(params: SendEmailParams): Promise<Result<{ messageId: string }, Error>>
}

export const emailService: IEmailService = {
  async send(params) {
    console.log(`[Email Stub] Would send email to ${params.to}: ${params.subject}`)
    return { success: true, value: { messageId: 'stub-' + Date.now() } }
  },
}
