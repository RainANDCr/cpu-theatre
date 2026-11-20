import { clsx, type ClassValue } from 'clsx'

/** 条件类名拼接。所有组件统一用它，避免模板字符串里堆三元表达式。 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
