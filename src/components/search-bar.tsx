'use client'

import { Search, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

interface SearchFilters {
  accountId?: string
  dateFrom?: Date
  dateTo?: Date
  sortBy?: 'newest' | 'oldest' | 'most_engaged'
}

interface SearchBarProps {
  onSearch: (query: string, filters?: SearchFilters) => void
  accounts?: Array<{
    id: string
    username: string
    displayName: string
  }>
  placeholder?: string
  className?: string
}

export function SearchBar({ 
  onSearch, 
  accounts = [], 
  placeholder = "Search your posted tweets...",
  className = ""
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [dateFromOpen, setDateFromOpen] = useState(false)
  const [dateToOpen, setDateToOpen] = useState(false)
  
  // Debounce search query
  const debouncedQuery = useDebounce(query, 300)

  // Effect to handle search with debounced query
  useEffect(() => {
    onSearch(debouncedQuery, filters)
  }, [debouncedQuery, filters, onSearch])

  const handleQueryChange = (value: string) => {
    setQuery(value)
  }

  const handleClearQuery = () => {
    setQuery('')
  }

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const clearFilters = () => {
    setFilters({})
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  return (
    <div className={`w-full max-w-2xl mx-auto space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          
          <Input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className="pl-12 pr-20 h-14 text-base bg-white/80 backdrop-blur-sm border-0 shadow-lg ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 focus:shadow-xl transition-all duration-200 rounded-2xl placeholder:text-gray-400"
          />
          
          <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
            {query && (
              <Button
                onClick={handleClearQuery}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            )}
            
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 hover:bg-gray-100 rounded-full relative ${
                    activeFiltersCount > 0 ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filters</h4>
                    {activeFiltersCount > 0 && (
                      <Button
                        onClick={clearFilters}
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>

                  {/* Account Filter */}
                  {accounts.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Account</Label>
                      <Select
                        value={filters.accountId || ''}
                        onValueChange={(value) => handleFilterChange('accountId', value || undefined)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All accounts" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All accounts</SelectItem>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              @{account.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Range Filter */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-gray-700">Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-9 justify-start text-left font-normal"
                          >
                            {filters.dateFrom ? (
                              format(filters.dateFrom, 'MMM dd')
                            ) : (
                              <span className="text-gray-400">From</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => {
                              handleFilterChange('dateFrom', date)
                              setDateFromOpen(false)
                            }}
                            disabled={(date) => {
                              const today = new Date()
                              return date > today || (filters.dateTo ? date > filters.dateTo : false)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-9 justify-start text-left font-normal"
                          >
                            {filters.dateTo ? (
                              format(filters.dateTo, 'MMM dd')
                            ) : (
                              <span className="text-gray-400">To</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => {
                              handleFilterChange('dateTo', date)
                              setDateToOpen(false)
                            }}
                            disabled={(date) => {
                              const today = new Date()
                              return date > today || (filters.dateFrom ? date < filters.dateFrom : false)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Sort Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Sort by</Label>
                    <Select
                      value={filters.sortBy || 'newest'}
                      onValueChange={(value) => handleFilterChange('sortBy', value as SearchFilters['sortBy'])}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="most_engaged">Most engaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm text-gray-600">Filters:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {filters.accountId && (
              <Badge variant="secondary" className="text-xs">
                Account: {accounts.find(a => a.id === filters.accountId)?.username || 'Selected'}
                <Button
                  onClick={() => handleFilterChange('accountId', undefined)}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {filters.dateFrom && (
              <Badge variant="secondary" className="text-xs">
                From: {format(filters.dateFrom, 'MMM dd')}
                <Button
                  onClick={() => handleFilterChange('dateFrom', undefined)}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {filters.dateTo && (
              <Badge variant="secondary" className="text-xs">
                To: {format(filters.dateTo, 'MMM dd')}
                <Button
                  onClick={() => handleFilterChange('dateTo', undefined)}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {filters.sortBy && filters.sortBy !== 'newest' && (
              <Badge variant="secondary" className="text-xs">
                Sort: {filters.sortBy === 'oldest' ? 'Oldest' : 'Most engaged'}
                <Button
                  onClick={() => handleFilterChange('sortBy', 'newest')}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchBar