import type { BaseQueryFn } from '@reduxjs/toolkit/query/react'
import axios from 'axios'
import type { AxiosRequestConfig, AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const axiosBaseQuery =
  (
    { baseUrl }: { baseUrl?: string } = {},
  ): BaseQueryFn<
    {
      url: string
      method?: AxiosRequestConfig['method']
      data?: AxiosRequestConfig['data']
      params?: AxiosRequestConfig['params']
      headers?: AxiosRequestConfig['headers']
    },
    unknown,
    { status: number; data: unknown }
  > =>
  async ({ url, method = 'GET', data, params, headers }) => {
    try {
      const result = await axios({
        url: `${baseUrl || API_BASE_URL}${url}`,
        method,
        data,
        params,
        headers,
      })
      return { data: result.data }
    } catch (axiosError) {
      const err = axiosError as AxiosError
      return {
        error: {
          status: err.response?.status ?? 0,
          data: err.response?.data ?? err.message,
        },
      }
    }
  }
