import Navbar from '@/components/navbar'
import DuolingoButton from '@/components/ui/duolingo-button'
import { getServerSession } from '@/lib/server-auth'
import Link from 'next/link'
import Script from 'next/script'
import YCButtonLight from '@/components/notycomb'
import { Spotlight } from '@/components/ui/spotlight-new'

export const dynamic = 'force-dynamic'

const Page = async () => {
  const session = await getServerSession()

  return (
    <>
      {/* Modern gradient background */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/50">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -left-32 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Navigation */}
        <div className="relative z-10">
          <div className="max-w-7xl mx-auto">
            <Navbar title={session ? 'Studio' : 'Login'} />
          </div>
        </div>

        {/* Hero Section with Spotlight */}
        <div className="relative min-h-[40rem] flex items-center justify-center overflow-hidden">
          {/* Spotlight effect - emerald/sky blue theme with higher visibility */}
          <Spotlight 
            gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(160, 100%, 75%, .35) 0, hsla(200, 100%, 70%, .20) 50%, hsla(180, 100%, 60%, 0) 80%)"
            gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(165, 100%, 80%, .25) 0, hsla(195, 100%, 75%, .15) 80%, transparent 100%)"
            gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(170, 100%, 85%, .20) 0, hsla(190, 100%, 80%, .10) 80%, transparent 100%)"
          />
          
          <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-32">
            <div className="max-w-5xl mx-auto">
              {/* Hero Content */}
              <div className="text-center space-y-12">
                {/* Badge */}
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-indigo-100 shadow-lg">
                  <span className="text-sm font-medium text-indigo-600">✨ AI-Powered Content Engine</span>
                </div>

                {/* Main Heading with Spotlight effect */}
                <div className="space-y-6">
                  <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
                      Grow your
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 bg-clip-text text-transparent">
                      Twitter presence
                    </span>
                  </h1>
                  
                  <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                    Create, schedule, and manage Twitter content that converts. 
                    <span className="font-semibold text-slate-800"> Perfect for founders and content creators</span> who want to build their audience efficiently.
                  </p>
                </div>


                {/* CTA Section */}
                <div className="space-y-8">
                  <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                    {session ? (
                      <Link href="/studio" className="w-full">
                        <DuolingoButton className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
                          Go to Studio →
                        </DuolingoButton>
                      </Link>
                    ) : (
                      <div className="w-full space-y-3">
                        <YCButtonLight />
                        <Link href="/sign-up" className="w-full">
                          <DuolingoButton className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
                            Start Creating Content →
                          </DuolingoButton>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Social Proof - moved inside the spotlight section */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg max-w-lg mx-auto">
                    <div className="flex -space-x-3">
                      <img
                        className="h-12 w-12 rounded-full ring-3 ring-white shadow-lg"
                        src="/images/user/ahmet_128.png"
                        alt="User testimonial"
                      />
                      <img
                        className="h-12 w-12 rounded-full ring-3 ring-white shadow-lg"
                        src="/images/user/chris_128.png"
                        alt="User testimonial"
                      />
                      <img
                        className="h-12 w-12 rounded-full ring-3 ring-white shadow-lg"
                        src="/images/user/justin_128.png"
                        alt="User testimonial"
                      />
                      <img
                        className="h-12 w-12 rounded-full ring-3 ring-white shadow-lg"
                        src="/images/user/rohit_128.png"
                        alt="User testimonial"
                      />
                      <img
                        className="h-12 w-12 rounded-full ring-3 ring-white shadow-lg"
                        src="/images/user/vladan_128.png"
                        alt="User testimonial"
                      />
                    </div>
                    
                    <div className="text-center sm:text-left">
                      <div className="flex justify-center sm:justify-start mb-2">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className="w-5 h-5 text-yellow-400 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-slate-700 font-medium">
                        Trusted by <span className="font-bold text-slate-900">1,140</span> founders
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}

export default Page

// https://widget.senja.io/widget/3fae6f42-6a34-4da8-81f2-d3389606a704/platform.js
