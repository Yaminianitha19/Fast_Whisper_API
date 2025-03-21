import { useState, useEffect } from 'react'
import { 
  CloudArrowUpIcon, 
  DocumentTextIcon, 
  ArrowPathIcon, 
  DocumentArrowDownIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon,
  SunIcon,
  MoonIcon,
  BookmarkIcon,
  ClockIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import axios from 'axios'

const SUPPORTED_EXTENSIONS = [
  { ext: 'mp3', name: 'MP3 Audio' },
  { ext: 'mp4', name: 'MP4 Audio' },
  { ext: 'mpeg', name: 'MPEG Audio' },
  { ext: 'mpga', name: 'MPGA Audio' },
  { ext: 'm4a', name: 'M4A Audio' },
  { ext: 'wav', name: 'WAV Audio' },
  { ext: 'webm', name: 'WebM Audio' },
  { ext: 'opus', name: 'Opus Audio' },
  { ext: 'flac', name: 'FLAC Audio' },
  { ext: 'ogg', name: 'OGG Audio' }
]

interface TranscriptionHistory {
  id: string
  text: string
  timestamp: Date
  bookmarks: number[]
  keywords: string[]
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [transcription, setTranscription] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [showExtensions, setShowExtensions] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [history, setHistory] = useState<TranscriptionHistory[]>([])
  const [bookmarks, setBookmarks] = useState<number[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TranscriptionHistory | null>(null)

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('transcriptionHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  useEffect(() => {
    // Save history to localStorage
    localStorage.setItem('transcriptionHistory', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    // Apply dark mode
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    // Check file size (max 25MB)
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('File size should be less than 25MB')
      return
    }

    // Check file extension
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
    const isSupported = SUPPORTED_EXTENSIONS.some(ext => ext.ext === fileExt)
    
    if (!isSupported) {
      setError(`Unsupported file type. Please upload one of the supported formats: ${SUPPORTED_EXTENSIONS.map(ext => ext.ext).join(', ')}`)
      return
    }

    setFile(selectedFile)
    setError('')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    setIsLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', 'base')
    formData.append('response_format', 'text')
    formData.append('language', 'en')

    try {
      const response = await axios.post('http://localhost:8000/v1/transcriptions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': 'Bearer dummy_api_key'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      let transcriptionText = ''
      if (typeof response.data === 'object' && 'text' in response.data) {
        transcriptionText = response.data.text
      } else if (typeof response.data === 'object' && Object.keys(response.data).length > 0) {
        const firstFileKey = Object.keys(response.data)[0]
        transcriptionText = response.data[firstFileKey].text
      } else {
        setError('Unexpected response format from server')
        return
      }

      setTranscription(transcriptionText)
      
      const newHistoryItem: TranscriptionHistory = {
        id: Date.now().toString(),
        text: transcriptionText,
        timestamp: new Date(),
        bookmarks: [],
        keywords: []
      }
      setHistory(prev => [newHistoryItem, ...prev])
      setSelectedHistoryItem(newHistoryItem)
    } catch (err: any) {
      console.error('Error:', err)
      if (err.response?.status === 401) {
        setError('Authentication failed. Please check your credentials.')
      } else if (err.response?.status === 413) {
        setError('File is too large. Please upload a smaller file.')
      } else if (err.response?.status === 415) {
        setError('Unsupported file type. Please upload a valid audio file.')
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Error transcribing file. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([transcription], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcription.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    setShowThankYou(true)
    setTimeout(() => setShowThankYou(false), 3000)
  }

  const highlightKeywords = (text: string) => {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }

  return (
    <div className={`min-h-screen w-screen flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-50'
    }`}>
      <div className="w-full h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${
            isDarkMode ? 'bg-violet-900' : 'bg-violet-100'
          }`}>
            <DocumentTextIcon className={`h-7 w-7 ${isDarkMode ? 'text-violet-300' : 'text-violet-600'}`} />
          </div>
          <h1 className={`text-3xl font-bold font-serif tracking-wide ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            FastWhisper API
          </h1>
          <p className={`text-base font-light italic mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Turn your voice into words, effortlessly and accurately.
          </p>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`mt-3 p-2 rounded-full transition-colors duration-300 ${
              isDarkMode ? 'bg-violet-900 text-violet-300 hover:bg-violet-800' : 'bg-violet-100 text-violet-600 hover:bg-violet-200'
            }`}
          >
            {isDarkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          {/* Left Column */}
          <div className="flex flex-col space-y-6 overflow-hidden">
            {/* Upload Section */}
            <div className={`flex-1 rounded-xl shadow-lg p-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <form onSubmit={handleSubmit} className="h-full flex flex-col">
                <div 
                  className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition-all duration-300 ${
                    isDragging 
                      ? 'border-violet-500 bg-violet-50' 
                      : 'border-gray-300 hover:border-violet-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <CloudArrowUpIcon className={`h-14 w-14 mb-3 transition-colors duration-300 ${
                    isDragging ? 'text-violet-500' : 'text-gray-400'
                  }`} />
                  <div className="text-center">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-violet-600 hover:text-violet-700 text-lg font-medium">
                        Click to upload
                      </span>
                      <span className="text-gray-500 ml-2">or drag and drop</span>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept="audio/*"
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowExtensions(!showExtensions)}
                      className="mt-3 text-base text-violet-600 hover:text-violet-700 font-medium"
                    >
                      {showExtensions ? 'Hide supported formats' : 'Show supported formats'}
                    </button>
                    {showExtensions && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {SUPPORTED_EXTENSIONS.map(({ ext }) => (
                            <div key={ext} className="text-base text-gray-600 bg-white px-3 py-2 rounded border border-gray-200">
                              {ext.toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {file && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-base text-gray-600">
                          <span className="font-medium">File:</span> {file.name}
                        </p>
                        <p className="text-base text-gray-500">
                          <span className="font-medium">Size:</span> {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 text-base text-center bg-red-50 p-3 rounded-lg border border-red-200 flex items-center justify-center mt-3">
                    <ExclamationCircleIcon className="h-5 w-5 mr-2 text-red-500" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !file}
                  className={`mt-3 py-3 px-6 rounded-lg font-medium text-white text-lg transition-all duration-300 ${
                    isLoading || !file
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-violet-700 hover:bg-violet-800'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Transcribing...
                    </span>
                  ) : (
                    'Start Transcription'
                  )}
                </button>
              </form>
            </div>

            {/* History Section */}
            <div className={`flex-1 rounded-xl shadow-lg p-6 overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                History
              </h2>
              <div className="h-[calc(100%-3rem)] overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-300 mb-2 ${
                      isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedHistoryItem(item)
                      setTranscription(item.text)
                      setBookmarks(item.bookmarks)
                      setKeywords(item.keywords)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-base text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setHistory(prev => prev.filter(h => h.id !== item.id))
                        }}
                        className="text-red-500 hover:text-red-600 text-base"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Transcription */}
          <div className={`rounded-xl shadow-lg p-6 flex flex-col ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center mb-3">
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>
                Transcription Result
              </h2>
            </div>

            {/* Search */}
            <div className="mb-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400" />
                <input
                  type="text"
                  placeholder="Search in transcription..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-base rounded-lg border border-blue-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Transcription Text */}
            <div className={`flex-1 rounded-lg border overflow-y-auto p-4 ${
              isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <p 
                className={`whitespace-pre-wrap leading-relaxed text-base font-medium font-sans ${
                  isDarkMode ? 'text-gray-100' : 'text-blue-900'
                }`}
                style={{ fontFamily: "'Inter', 'Roboto', 'Poppins', sans-serif" }}
                dangerouslySetInnerHTML={{ __html: highlightKeywords(transcription || 'Your transcription will appear here...') }}
              />
            </div>

            {/* Download Button */}
            {transcription && (
              <button
                onClick={handleDownload}
                className="mt-3 py-3 px-6 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300 flex items-center justify-center text-lg"
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                Download
              </button>
            )}
          </div>
        </div>

        {showThankYou && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 px-6 py-3 rounded-lg shadow-lg border border-green-200 dark:border-green-800 flex items-center space-x-3 animate-bounce text-base">
            <span className="text-xl mr-2">🌸</span>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <span>Thank you for downloading!</span>
            <span className="text-xl ml-2">🌸</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
