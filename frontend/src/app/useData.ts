import { useContext } from 'react'
import { DataContext } from './dataState'

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}
