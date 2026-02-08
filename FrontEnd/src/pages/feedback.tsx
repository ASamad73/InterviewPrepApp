// // // import { useState, useEffect } from 'react'
// // // import { useUser, useAuth } from '@clerk/clerk-react'
// // // import { Link } from 'react-router-dom'

// // // // Define the interview type
// // // interface Interview {
// // //   id: string
// // //   title: string
// // //   company: string
// // //   status: 'completed' | 'in-progress' | 'scheduled'
// // //   date: string
// // //   role?: string
// // // }

// // // export default function Feedback() {
// // //   const { user, isLoaded } = useUser()
// // //   const { getToken } = useAuth()
// // //   const [interviews, setInterviews] = useState<Interview[]>([])
// // //   const [loading, setLoading] = useState(true)
// // //   const [error, setError] = useState<string | null>(null)

// // //   useEffect(() => {
// // //     async function fetchAllInterviews() {
// // //       if (!user || !isLoaded) return

// // //       try {
// // //         setLoading(true)
// // //         const token = await getToken({ template: "interview-backend" })
        
// // //         const headers = {
// // //           'Content-Type': 'application/json',
// // //           'Authorization': `Bearer ${token}`
// // //         }

// // //         // Fetch ALL interviews (not just 3)
// // //         const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interviews/user/interviews`, { headers })
// // //         if (!response.ok) throw new Error('Failed to fetch interviews')
        
// // //         const data = await response.json()
// // //         if (data.ok) {
// // //           setInterviews(data.interviews)
// // //         } else {
// // //           setError('No interviews found')
// // //         }

// // //       } catch (err: any) {
// // //         console.error('Error fetching interviews:', err)
// // //         setError(err.message || 'Failed to load interviews')
// // //       } finally {
// // //         setLoading(false)
// // //       }
// // //     }

// // //     fetchAllInterviews()
// // //   }, [user, isLoaded, getToken])

// // //   // Handle generating report for a specific interview
// // //   const handleGetReport = async (interviewId: string, interviewTitle: string) => {
// // //     try {
// // //       const token = await getToken({ template: "interview-backend" })
      
// // //       // Call backend API to generate PDF report
// // //       const response = await fetch(
// // //         `${import.meta.env.VITE_API_URL}/api/feedback/report/${interviewId}`,
// // //         {
// // //           method: 'GET',
// // //           headers: {
// // //             'Authorization': `Bearer ${token}`,
// // //           },
// // //         }
// // //       )

// // //       if (!response.ok) throw new Error('Failed to generate report')

// // //       // Create blob from response
// // //       const blob = await response.blob()
      
// // //       // Create download link
// // //       const url = window.URL.createObjectURL(blob)
// // //       const a = document.createElement('a')
// // //       a.href = url
// // //       a.download = `${interviewTitle.replace(/\s+/g, '_')}_Feedback_Report.pdf`
// // //       document.body.appendChild(a)
// // //       a.click()
      
// // //       // Cleanup
// // //       window.URL.revokeObjectURL(url)
// // //       document.body.removeChild(a)

// // //     } catch (err: any) {
// // //       console.error('Error generating report:', err)
// // //       alert('Failed to generate report. Please try again.')
// // //     }
// // //   }

// // //   // Show loading state
// // //   if (!isLoaded || loading) {
// // //     return (
// // //       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// // //         <div className="mx-auto max-w-6xl">
// // //           <div className="text-center text-gray-400">Loading interviews...</div>
// // //         </div>
// // //       </main>
// // //     )
// // //   }

// // //   // Show not signed in state
// // //   if (!user) {
// // //     return (
// // //       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// // //         <div className="mx-auto max-w-6xl text-center">
// // //           <div className="text-white text-lg mb-4">Please sign in to view feedback reports</div>
// // //           <Link 
// // //             to="/" 
// // //             className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
// // //           >
// // //             Go to Homepage
// // //           </Link>
// // //         </div>
// // //       </main>
// // //     )
// // //   }

// // //   return (
// // //     <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// // //       <div className="mx-auto max-w-6xl space-y-8">
        
// // //         {/* Header */}
// // //         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
// // //           <div>
// // //             <h1 className="text-3xl font-bold text-white">Feedback Reports</h1>
// // //             <p className="text-gray-400 mt-2">Generate PDF reports for your interview feedback</p>
// // //           </div>
          
// // //           <Link 
// // //             to="/profile" 
// // //             className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
// // //           >
// // //             Back to Profile
// // //           </Link>
// // //         </div>

// // //         {error && (
// // //           <div className="rounded-md bg-red-800/60 p-4 text-red-100">
// // //             {error}
// // //           </div>
// // //         )}

// // //         {/* Interviews List */}
// // //         <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
// // //           <div className="mb-6">
// // //             <h2 className="text-xl font-semibold text-white">Your Interviews</h2>
// // //             <p className="text-gray-400 mt-1">
// // //               {interviews.length} interview{interviews.length !== 1 ? 's' : ''} found
// // //             </p>
// // //           </div>
          
// // //           {interviews.length > 0 ? (
// // //             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
// // //               {interviews.map((interview) => (
// // //                 <div 
// // //                   key={interview.id} 
// // //                   className="flex flex-col gap-4 rounded-md border border-white/5 bg-[#121212] p-4 transition hover:border-white/10 hover:bg-[#161616] sm:flex-row sm:items-center sm:justify-between"
// // //                 >
// // //                   <div className="flex-1">
// // //                     <div className="flex items-start justify-between">
// // //                       <div>
// // //                         <h3 className="font-medium text-white">{interview.title}</h3>
// // //                         <div className="mt-2 flex flex-wrap gap-2">
// // //                           <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
// // //                             {interview.company}
// // //                           </span>
// // //                           {interview.role && (
// // //                             <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400">
// // //                               {interview.role}
// // //                             </span>
// // //                           )}
// // //                           <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
// // //                             interview.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
// // //                             interview.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' :
// // //                             'bg-blue-500/10 text-blue-400'
// // //                           }`}>
// // //                             {interview.status}
// // //                           </span>
// // //                         </div>
// // //                       </div>
                      
// // //                       <div className="text-right">
// // //                         <p className="text-sm text-gray-400">
// // //                           {interview.date ? new Date(interview.date).toLocaleDateString('en-US', {
// // //                             year: 'numeric',
// // //                             month: 'short',
// // //                             day: 'numeric'
// // //                           }) : 'No date'}
// // //                         </p>
// // //                       </div>
// // //                     </div>
// // //                   </div>

// // //                   {/* Only Get Report button remains */}
// // //                   <div className="flex justify-end">
// // //                     <button
// // //                       onClick={() => handleGetReport(interview.id, interview.title)}
// // //                       className="rounded-md bg-[#3ecf8e] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#36be81] transition-colors whitespace-nowrap w-full sm:w-auto"
// // //                     >
// // //                       Get Report
// // //                     </button>
// // //                   </div>
// // //                 </div>
// // //               ))}
// // //             </div>
// // //           ) : (
// // //             <div className="text-center py-12">
// // //               <div className="mx-auto w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
// // //                 <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// // //                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
// // //                 </svg>
// // //               </div>
// // //               <p className="text-gray-400 mb-4">No interviews found.</p>
// // //               <Link 
// // //                 to="/create-interview" 
// // //                 className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
// // //               >
// // //                 Create Your First Interview
// // //               </Link>
// // //             </div>
// // //           )}
// // //         </div>

// // //         {/* Info Box */}
// // //         <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
// // //           <div className="flex items-start gap-3">
// // //             <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// // //               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
// // //             </svg>
// // //             <div>
// // //               <h3 className="font-medium text-emerald-400">About Feedback Reports</h3>
// // //               <p className="text-emerald-300/80 text-sm mt-1">
// // //                 Each report includes detailed feedback, ratings, and analysis from your interview. 
// // //                 Reports are generated as PDF files that you can save or share.
// // //               </p>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       </div>
// // //     </main>
// // //   )
// // // }

// // import { useState, useEffect } from 'react'
// // import { useUser, useAuth } from '@clerk/clerk-react'
// // import { Link } from 'react-router-dom'

// // // Define the interview type
// // interface Interview {
// //   id: string
// //   title: string
// //   company: string
// //   status: 'completed' | 'in-progress' | 'scheduled'
// //   date: string
// //   role?: string
// // }

// // export default function Feedback() {
// //   const { user, isLoaded } = useUser()
// //   const { getToken } = useAuth()
// //   const [interviews, setInterviews] = useState<Interview[]>([])
// //   const [loading, setLoading] = useState(true)
// //   const [error, setError] = useState<string | null>(null)
// //   const [generatingReport, setGeneratingReport] = useState<string | null>(null)

// //   useEffect(() => {
// //     async function fetchAllInterviews() {
// //       if (!user || !isLoaded) return

// //       try {
// //         setLoading(true)
// //         const token = await getToken({ template: "interview-backend" })
        
// //         const headers = {
// //           'Content-Type': 'application/json',
// //           'Authorization': `Bearer ${token}`
// //         }

// //         // Fetch ALL interviews (not just 3)
// //         const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interviews/user/interviews`, { headers })
// //         if (!response.ok) throw new Error('Failed to fetch interviews')
        
// //         const data = await response.json()
// //         if (data.ok) {
// //           setInterviews(data.interviews)
// //         } else {
// //           setError('No interviews found')
// //         }

// //       } catch (err: any) {
// //         console.error('Error fetching interviews:', err)
// //         setError(err.message || 'Failed to load interviews')
// //       } finally {
// //         setLoading(false)
// //       }
// //     }

// //     fetchAllInterviews()
// //   }, [user, isLoaded, getToken])

// //   // Handle generating report for a specific interview
// //   const handleGetReport = async (interviewId: string, interviewTitle: string) => {
// //     try {
// //       setGeneratingReport(interviewId)
// //       const token = await getToken({ template: "interview-backend" })
      
// //       // CORRECT ENDPOINT - Use interviews/report not feedback/report
// //       const url = `${import.meta.env.VITE_API_URL}/api/interviews/report/${interviewId}`;
      
// //       console.log("📄 Calling PDF endpoint:", url); // Add this for debugging
      
// //       const response = await fetch(url, {
// //         headers: {
// //           'Authorization': `Bearer ${token}`,
// //         },
// //       })
  
// //       if (!response.ok) {
// //         const errorText = await response.text()
// //         console.error("❌ PDF generation failed:", response.status, errorText)
// //         throw new Error(`Failed to generate report: ${response.status}`)
// //       }
  
// //       // Get the PDF blob
// //       const blob = await response.blob()
// //       console.log("✅ PDF blob received, size:", blob.size)
      
// //       // Create blob URL
// //       const blobUrl = URL.createObjectURL(blob)
      
// //       // Open in new tab
// //       const newWindow = window.open(blobUrl, '_blank')
      
// //       // Fallback: If popup blocked, offer download
// //       if (!newWindow) {
// //         const a = document.createElement('a')
// //         a.href = blobUrl
// //         a.download = `${interviewTitle.replace(/\s+/g, '_')}_Feedback_Report.pdf`
// //         document.body.appendChild(a)
// //         a.click()
// //         document.body.removeChild(a)
// //       }
      
// //       // Cleanup blob URL after some time
// //       setTimeout(() => {
// //         URL.revokeObjectURL(blobUrl)
// //       }, 1000)
  
// //     } catch (err: any) {
// //       console.error('Error generating report:', err)
// //       alert(`Failed to generate report: ${err.message}`)
// //     } finally {
// //       setGeneratingReport(null)
// //     }
// //   }
// // //   const handleGetReport = async (interviewId: string, interviewTitle: string) => {
// // //     try {
// // //       setGeneratingReport(interviewId)
// // //       const token = await getToken({ template: "interview-backend" })
      
// // //       // CORRECTED: Use the new endpoint path
// // //       const url = `${import.meta.env.VITE_API_URL}/api/interviews/report/${interviewId}`;
      
// // //       // Method 1: Direct window.open with auth (simplest)
// // //       // Create a hidden iframe or use fetch to pass auth header
      
// // //       // Method 2: Fetch with auth and open blob (recommended)
// // //       const response = await fetch(url, {
// // //         headers: {
// // //           'Authorization': `Bearer ${token}`,
// // //         },
// // //       })

// // //       if (!response.ok) {
// // //         const errorText = await response.text()
// // //         throw new Error(`Failed to generate report: ${response.status} ${errorText}`)
// // //       }

// // //       // Get the PDF blob
// // //       const blob = await response.blob()
      
// // //       // Create blob URL
// // //       const blobUrl = URL.createObjectURL(blob)
      
// // //       // Open in new tab
// // //       const newWindow = window.open(blobUrl, '_blank')
      
// // //       // Fallback: If popup blocked, offer download
// // //       if (!newWindow) {
// // //         const a = document.createElement('a')
// // //         a.href = blobUrl
// // //         a.download = `${interviewTitle.replace(/\s+/g, '_')}_Feedback_Report.pdf`
// // //         document.body.appendChild(a)
// // //         a.click()
// // //         document.body.removeChild(a)
// // //       }
      
// // //       // Cleanup blob URL after some time
// // //       setTimeout(() => {
// // //         URL.revokeObjectURL(blobUrl)
// // //       }, 1000)

// // //     } catch (err: any) {
// // //       console.error('Error generating report:', err)
// // //       alert(`Failed to generate report: ${err.message}`)
// // //     } finally {
// // //       setGeneratingReport(null)
// // //     }
// // //   }

// //   // Show loading state
// //   if (!isLoaded || loading) {
// //     return (
// //       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// //         <div className="mx-auto max-w-6xl">
// //           <div className="text-center text-gray-400">Loading interviews...</div>
// //         </div>
// //       </main>
// //     )
// //   }

// //   // Show not signed in state
// //   if (!user) {
// //     return (
// //       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// //         <div className="mx-auto max-w-6xl text-center">
// //           <div className="text-white text-lg mb-4">Please sign in to view feedback reports</div>
// //           <Link 
// //             to="/" 
// //             className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
// //           >
// //             Go to Homepage
// //           </Link>
// //         </div>
// //       </main>
// //     )
// //   }

// //   return (
// //     <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
// //       <div className="mx-auto max-w-6xl space-y-8">
        
// //         {/* Header */}
// //         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
// //           <div>
// //             <h1 className="text-3xl font-bold text-white">Feedback Reports</h1>
// //             <p className="text-gray-400 mt-2">Generate PDF reports for your interview feedback</p>
// //           </div>
          
// //           <Link 
// //             to="/profile" 
// //             className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
// //           >
// //             Back to Profile
// //           </Link>
// //         </div>

// //         {error && (
// //           <div className="rounded-md bg-red-800/60 p-4 text-red-100">
// //             {error}
// //           </div>
// //         )}

// //         {/* Interviews List */}
// //         <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
// //           <div className="mb-6">
// //             <h2 className="text-xl font-semibold text-white">Your Interviews</h2>
// //             <p className="text-gray-400 mt-1">
// //               {interviews.length} interview{interviews.length !== 1 ? 's' : ''} found
// //             </p>
// //           </div>
          
// //           {interviews.length > 0 ? (
// //             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
// //               {interviews.map((interview) => (
// //                 <div 
// //                   key={interview.id} 
// //                   className="flex flex-col gap-4 rounded-md border border-white/5 bg-[#121212] p-4 transition hover:border-white/10 hover:bg-[#161616] sm:flex-row sm:items-center sm:justify-between"
// //                 >
// //                   <div className="flex-1">
// //                     <div className="flex items-start justify-between">
// //                       <div>
// //                         <h3 className="font-medium text-white">{interview.title}</h3>
// //                         <div className="mt-2 flex flex-wrap gap-2">
// //                           <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
// //                             {interview.company}
// //                           </span>
// //                           {interview.role && (
// //                             <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400">
// //                               {interview.role}
// //                             </span>
// //                           )}
// //                           <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
// //                             interview.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
// //                             interview.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' :
// //                             'bg-blue-500/10 text-blue-400'
// //                           }`}>
// //                             {interview.status}
// //                           </span>
// //                         </div>
// //                       </div>
                      
// //                       <div className="text-right">
// //                         <p className="text-sm text-gray-400">
// //                           {interview.date ? new Date(interview.date).toLocaleDateString('en-US', {
// //                             year: 'numeric',
// //                             month: 'short',
// //                             day: 'numeric'
// //                           }) : 'No date'}
// //                         </p>
// //                       </div>
// //                     </div>
// //                   </div>

// //                   {/* Only Get Report button remains */}
// //                   <div className="flex justify-end">
// //                     <button
// //                       onClick={() => handleGetReport(interview.id, interview.title)}
// //                       disabled={generatingReport === interview.id}
// //                       className="rounded-md bg-[#3ecf8e] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#36be81] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-2"
// //                     >
// //                       {generatingReport === interview.id ? (
// //                         <>
// //                           <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
// //                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
// //                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
// //                           </svg>
// //                           Generating...
// //                         </>
// //                       ) : (
// //                         'Get Report'
// //                       )}
// //                     </button>
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           ) : (
// //             <div className="text-center py-12">
// //               <div className="mx-auto w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
// //                 <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// //                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
// //                 </svg>
// //               </div>
// //               <p className="text-gray-400 mb-4">No interviews found.</p>
// //               <Link 
// //                 to="/create-interview" 
// //                 className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
// //               >
// //                 Create Your First Interview
// //               </Link>
// //             </div>
// //           )}
// //         </div>

// //         {/* Info Box */}
// //         <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
// //           <div className="flex items-start gap-3">
// //             <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// //               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
// //             </svg>
// //             <div>
// //               <h3 className="font-medium text-emerald-400">About Feedback Reports</h3>
// //               <p className="text-emerald-300/80 text-sm mt-1">
// //                 Each report includes detailed feedback, ratings, and analysis from your interview. 
// //                 Reports are generated as PDF files that you can save or share.
// //                 Click "Get Report" to generate and view/download the PDF.
// //               </p>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     </main>
// //   )
// // }

// import { useState, useEffect } from 'react'
// import { useUser, useAuth } from '@clerk/clerk-react'
// import { Link } from 'react-router-dom'

// // Define the interview type
// interface Interview {
//   id: string
//   title: string
//   company: string
//   status: 'completed' | 'in-progress' | 'scheduled'
//   date: string
//   role?: string
// }

// export default function Feedback() {
//   const { user, isLoaded } = useUser()
//   const { getToken } = useAuth()
//   const [interviews, setInterviews] = useState<Interview[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   const [generatingReport, setGeneratingReport] = useState<string | null>(null)

//   useEffect(() => {
//     async function fetchAllInterviews() {
//       if (!user || !isLoaded) return

//       try {
//         setLoading(true)
//         const token = await getToken({ template: "interview-backend" })
        
//         const headers = {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         }

//         // Fetch ALL interviews (not just 3)
//         const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interviews/user/interviews`, { headers })
//         if (!response.ok) throw new Error('Failed to fetch interviews')
        
//         const data = await response.json()
//         if (data.ok) {
//           setInterviews(data.interviews)
//         } else {
//           setError('No interviews found')
//         }

//       } catch (err: any) {
//         console.error('Error fetching interviews:', err)
//         setError(err.message || 'Failed to load interviews')
//       } finally {
//         setLoading(false)
//       }
//     }

//     fetchAllInterviews()
//   }, [user, isLoaded, getToken])

//   // Handle generating report for a specific interview
//   const handleGetReport = async (interviewId: string, interviewTitle: string) => {
//     try {
//       setGeneratingReport(interviewId)
//       const token = await getToken({ template: "interview-backend" })
      
//       // CORRECT ENDPOINT - Use interviews/report not feedback/report
//       const url = `${import.meta.env.VITE_API_URL}/api/interviews/report/${interviewId}`;
      
//       console.log("📄 Calling PDF endpoint:", url);
      
//       const response = await fetch(url, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//         },
//       })

//       if (!response.ok) {
//         const errorText = await response.text()
//         console.error("❌ PDF generation failed:", response.status, errorText)
//         throw new Error(`Failed to generate report: ${response.status}`)
//       }

//       // Get the PDF blob
//       const blob = await response.blob()
//       console.log("✅ PDF blob received, size:", blob.size)
      
//       // Create blob URL
//       const blobUrl = URL.createObjectURL(blob)
      
//       // Open in new tab
//       const newWindow = window.open(blobUrl, '_blank')
      
//       // Fallback: If popup blocked, offer download
//       if (!newWindow) {
//         const a = document.createElement('a')
//         a.href = blobUrl
//         a.download = `${interviewTitle.replace(/\s+/g, '_')}_Feedback_Report.pdf`
//         document.body.appendChild(a)
//         a.click()
//         document.body.removeChild(a)
//       }
      
//       // Cleanup blob URL after some time
//       setTimeout(() => {
//         URL.revokeObjectURL(blobUrl)
//       }, 1000)

//     } catch (err: any) {
//       console.error('Error generating report:', err)
//       alert(`Failed to generate report: ${err.message}`)
//     } finally {
//       setGeneratingReport(null)
//     }
//   }

//   // Show loading state
//   if (!isLoaded || loading) {
//     return (
//       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
//         <div className="mx-auto max-w-6xl">
//           <div className="text-center text-gray-400">Loading interviews...</div>
//         </div>
//       </main>
//     )
//   }

//   // Show not signed in state
//   if (!user) {
//     return (
//       <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
//         <div className="mx-auto max-w-6xl text-center">
//           <div className="text-white text-lg mb-4">Please sign in to view feedback reports</div>
//           <Link 
//             to="/" 
//             className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
//           >
//             Go to Homepage
//           </Link>
//         </div>
//       </main>
//     )
//   }

//   return (
//     <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
//       <div className="mx-auto max-w-6xl space-y-8">
        
//         {/* Header */}
//         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
//           <div>
//             <h1 className="text-3xl font-bold text-white">Feedback Reports</h1>
//             <p className="text-gray-400 mt-2">Generate PDF reports for your interview feedback</p>
//           </div>
          
//           <Link 
//             to="/profile" 
//             className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
//           >
//             Back to Profile
//           </Link>
//         </div>

//         {error && (
//           <div className="rounded-md bg-red-800/60 p-4 text-red-100">
//             {error}
//           </div>
//         )}

//         {/* Interviews List */}
//         <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
//           <div className="mb-6">
//             <h2 className="text-xl font-semibold text-white">Your Interviews</h2>
//             <p className="text-gray-400 mt-1">
//               {interviews.length} interview{interviews.length !== 1 ? 's' : ''} found
//             </p>
//           </div>
          
//           {interviews.length > 0 ? (
//             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
//               {interviews.map((interview) => (
//                 <div 
//                   key={interview.id} 
//                   className="flex flex-col gap-4 rounded-md border border-white/5 bg-[#121212] p-4 transition hover:border-white/10 hover:bg-[#161616] sm:flex-row sm:items-center sm:justify-between"
//                 >
//                   <div className="flex-1">
//                     <div className="flex items-start justify-between">
//                       <div>
//                         <h3 className="font-medium text-white">{interview.title}</h3>
//                         <div className="mt-2 flex flex-wrap gap-2">
//                           <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
//                             {interview.company}
//                           </span>
//                           {interview.role && (
//                             <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400">
//                               {interview.role}
//                             </span>
//                           )}
//                           <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
//                             interview.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
//                             interview.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' :
//                             'bg-blue-500/10 text-blue-400'
//                           }`}>
//                             {interview.status}
//                           </span>
//                         </div>
//                       </div>
                      
//                       <div className="text-right">
//                         <p className="text-sm text-gray-400">
//                           {interview.date ? new Date(interview.date).toLocaleDateString('en-US', {
//                             year: 'numeric',
//                             month: 'short',
//                             day: 'numeric'
//                           }) : 'No date'}
//                         </p>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Only Get Report button remains */}
//                   <div className="flex justify-end">
//                     <button
//                       onClick={() => handleGetReport(interview.id, interview.title)}
//                       disabled={generatingReport === interview.id}
//                       className="rounded-md bg-[#3ecf8e] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#36be81] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-2"
//                     >
//                       {generatingReport === interview.id ? (
//                         <>
//                           <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
//                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
//                           </svg>
//                           Generating...
//                         </>
//                       ) : (
//                         'Get Report'
//                       )}
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="text-center py-12">
//               <div className="mx-auto w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
//                 <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
//                 </svg>
//               </div>
//               <p className="text-gray-400 mb-4">No interviews found.</p>
//               <Link 
//                 to="/create-interview" 
//                 className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
//               >
//                 Create Your First Interview
//               </Link>
//             </div>
//           )}
//         </div>

//         {/* Info Box */}
//         <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
//           <div className="flex items-start gap-3">
//             <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
//             </svg>
//             <div>
//               <h3 className="font-medium text-emerald-400">About Feedback Reports</h3>
//               <p className="text-emerald-300/80 text-sm mt-1">
//                 Each report includes detailed feedback, ratings, and analysis from your interview. 
//                 Reports are generated as PDF files that you can save or share.
//                 Click "Get Report" to generate and view/download the PDF.
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </main>
//   )
// }

import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

// Define the interview type
interface Interview {
  id: string
  title: string
  company: string
  status: 'completed' | 'in-progress' | 'scheduled'
  date: string
  role?: string
}

export default function Feedback() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAllInterviews() {
      if (!user || !isLoaded) return

      try {
        setLoading(true)
        const token = await getToken({ template: "interview-backend" })
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }

        // Fetch ALL interviews (not just 3)
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interviews/user/interviews`, { headers })
        if (!response.ok) throw new Error('Failed to fetch interviews')
        
        const data = await response.json()
        if (data.ok) {
          setInterviews(data.interviews)
        } else {
          setError('No interviews found')
        }

      } catch (err: any) {
        console.error('Error fetching interviews:', err)
        setError(err.message || 'Failed to load interviews')
      } finally {
        setLoading(false)
      }
    }

    fetchAllInterviews()
  }, [user, isLoaded, getToken])

  // Handle generating report for a specific interview
  const handleGetReport = async (interviewId: string, interviewTitle: string) => {
    try {
      setGeneratingReport(interviewId)
      setReportError(null) // Clear any previous errors
      
      const token = await getToken({ template: "interview-backend" })
      
      // CORRECT ENDPOINT - Use interviews/report not feedback/report
      const url = `${import.meta.env.VITE_API_URL}/api/interviews/report/${interviewId}`;
      
      console.log("📄 Calling PDF endpoint:", url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ PDF generation failed:", response.status, errorText)
        
        // Try to parse error message from backend
        let errorMessage = 'Unable to generate report';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If not JSON, use the text or status
          if (errorText && errorText.length < 100) {
            errorMessage = errorText;
          } else if (response.status === 404) {
            errorMessage = 'Interview data not found';
          } else if (response.status === 500) {
            errorMessage = 'Server error while generating report';
          }
        }
        
        throw new Error(errorMessage);
      }

      // Get the PDF blob
      const blob = await response.blob()
      console.log("✅ PDF blob received, size:", blob.size)
      
      // Check if blob is valid
      if (blob.size === 0) {
        throw new Error('Empty PDF generated');
      }
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob)
      
      // Open in new tab
      const newWindow = window.open(blobUrl, '_blank')
      
      // Fallback: If popup blocked, offer download
      if (!newWindow) {
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `${interviewTitle.replace(/\s+/g, '_')}_Feedback_Report.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      
      // Cleanup blob URL after some time
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 1000)

    } catch (err: any) {
      console.error('Error generating report:', err)
      setReportError(err.message || 'Unable to generate report')
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setReportError(null)
      }, 5000)
      
    } finally {
      setGeneratingReport(null)
    }
  }

  // Show loading state
  if (!isLoaded || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center text-gray-400">Loading interviews...</div>
        </div>
      </main>
    )
  }

  // Show not signed in state
  if (!user) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <div className="text-white text-lg mb-4">Please sign in to view feedback reports</div>
          <Link 
            to="/" 
            className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
          >
            Go to Homepage
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Feedback Reports</h1>
            <p className="text-gray-400 mt-2">Generate PDF reports for your interview feedback</p>
          </div>
          
          <Link 
            to="/profile" 
            className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back to Profile
          </Link>
        </div>

        {/* Report generation error message */}
        {reportError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-red-400">Unable to generate report</h3>
                <p className="text-red-300/80 text-sm mt-1">
                  {reportError}. Please try again or contact support if the problem persists.
                </p>
              </div>
              <button
                onClick={() => setReportError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* General error */}
        {error && (
          <div className="rounded-md bg-red-800/60 p-4 text-red-100">
            {error}
          </div>
        )}

        {/* Interviews List */}
        <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Your Interviews</h2>
            <p className="text-gray-400 mt-1">
              {interviews.length} interview{interviews.length !== 1 ? 's' : ''} found
            </p>
          </div>
          
          {interviews.length > 0 ? (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {interviews.map((interview) => (
                <div 
                  key={interview.id} 
                  className="flex flex-col gap-4 rounded-md border border-white/5 bg-[#121212] p-4 transition hover:border-white/10 hover:bg-[#161616] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-white">{interview.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                            {interview.company}
                          </span>
                          {interview.role && (
                            <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400">
                              {interview.role}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                            interview.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                            interview.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>
                            {interview.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-400">
                          {interview.date ? new Date(interview.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'No date'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Only Get Report button remains */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleGetReport(interview.id, interview.title)}
                      disabled={generatingReport === interview.id}
                      className="rounded-md bg-[#3ecf8e] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#36be81] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      {generatingReport === interview.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        'Get Report'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No interviews found.</p>
              <Link 
                to="/create-interview" 
                className="inline-flex items-center rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
              >
                Create Your First Interview
              </Link>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-medium text-emerald-400">About Feedback Reports</h3>
              <p className="text-emerald-300/80 text-sm mt-1">
                Each report includes detailed feedback, ratings, and analysis from your interview. 
                Reports are generated as PDF files that you can save or share.
                Click "Get Report" to generate and view/download the PDF.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}