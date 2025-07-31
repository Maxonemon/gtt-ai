// Fix for missing types for pdf-parse
// @ts-ignore
'use client';

import { useState, useRef, useEffect, RefObject } from 'react';
import { ArrowUp, Square, Upload, X, Plus, Copy, Check, Eye, Linkedin } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { marked } from 'marked';
// Utility to strip markdown to plain text
function markdownToText(md: string): string {
  // Use marked to parse markdown and get plain text
  const html = typeof marked.parse === 'function' ? marked.parse(md, { breaks: true }) : '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html as string;
  return tmp.textContent || tmp.innerText || '';
}

export default function Page() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Veuillez télécharger uniquement un fichier PDF.');
      return;
    }
    setUploadedFile(file);
    setFileContent('');
    setShowPreview(true);
    
    // Create a blob URL for preview
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    
    // Reset file input value so the same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      try {
        // Load PDF.js from CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        
        script.onload = async () => {
          try {
            // Access PDF.js from global scope
            const pdfjsLib = (window as any).pdfjsLib;
            
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: typedArray });
            const pdf = await loadingTask.promise;
            
            // Check if PDF is encrypted
            if (pdf._pdfInfo && pdf._pdfInfo.encrypted) {
              setFileContent('');
              alert('Ce PDF est protégé ou chiffré et ne peut pas être extrait.');
              return;
            }
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const strings = content.items.map((item: any) => item.str);
              fullText += strings.join(' ') + '\n\n';
            }
            setFileContent(fullText.trim());
          } catch (err) {
            setFileContent('');
            console.error('Erreur lors de l\'extraction du texte du PDF:', err);
            alert('Erreur lors de l\'extraction du texte du PDF.\nVérifiez que le fichier n\'est pas protégé, corrompu ou trop volumineux. Consultez la console pour plus de détails.');
          }
        };
        
        script.onerror = () => {
          console.error('Failed to load PDF.js');
          alert('Erreur lors du chargement de la bibliothèque PDF.');
        };
        
      } catch (err) {
        setFileContent('');
        console.error('Erreur lors de l\'extraction du texte du PDF:', err);
        alert('Erreur lors de l\'extraction du texte du PDF.\nVérifiez que le fichier n\'est pas protégé, corrompu ou trop volumineux. Consultez la console pour plus de détails.');
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  const removeFile = (): void => {
    setUploadedFile(null);
    setFileContent('');
    setShowPreview(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const togglePreview = (): void => {
    setShowPreview(!showPreview);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          fileContent: fileContent || null
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Add empty assistant message that will be filled
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulatedContent += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = accumulatedContent;
                  return newMessages;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          role: 'assistant', 
          content: 'Je m\'excuse, mais j\'ai rencontré une erreur. Veuillez réessayer.' 
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <TooltipProvider>
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center space-x-3">
              <svg viewBox="0 0 863 162" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M334.75 114.42C326.86 114.42 323.89 110.96 323.89 105.41C323.89 98.99 327.47 95.66 336.85 95.66H349.19V99.36C349.19 109.11 343.14 114.42 334.75 114.42ZM313.28 106.39C313.28 114.04 317.72 122.19 331.54 122.19C339.56 122.19 345.11 119.11 348.94 114.17L350.3 120.96H358.94V84.43C358.94 68.76 349.56 66.05 338.46 66.05C330.07 66.05 319.09 68.51 316.37 81.1H326.98C328.34 76.41 331.55 73.7 338.33 73.7C343.88 73.7 349.19 75.67 349.19 84.55V88.38H337.47C323.4 88.38 313.28 93.07 313.28 106.39ZM285.02 120.96H295.02V87.4C295.02 79.62 299.83 76.04 306 76.04C308.1 76.04 310.2 76.17 312.42 76.54V66.79C310.57 66.17 308.84 66.05 307.11 66.05C301.56 66.05 297.24 69.38 295.02 73.95L293.79 67.41H285.03V120.96H285.02ZM639.49 120.96H649.49V87.4C649.49 79.62 654.3 76.04 660.47 76.04C662.57 76.04 664.67 76.17 666.89 76.54V66.79C665.03 66.17 663.31 66.05 661.59 66.05C656.04 66.05 651.71 69.38 649.49 73.95L648.26 67.41H639.49V120.96ZM451.59 76.16V67.4H440.62V52.1L430.38 53.71V67.4H422.61V76.16H430.38V110.22C430.38 117.87 433.22 122.43 444.45 122.43C446.92 122.43 450.62 121.94 452.84 121.32V113.67C450.5 114.29 448.28 114.41 446.67 114.41C441.98 114.41 440.62 112.19 440.62 107.26V76.16H451.59ZM753.14 76.16V67.4H742.15V52.1L731.92 53.71V67.4H724.14V76.16H731.92V110.22C731.92 117.87 734.75 122.43 745.98 122.43C748.45 122.43 752.15 121.94 754.38 121.32V113.67C752.04 114.29 749.81 114.41 748.21 114.41C743.52 114.41 742.15 112.19 742.15 107.26V76.16H753.14ZM604.2 114.05C594.58 114.05 588.41 107.38 588.41 94.06C588.41 80.74 594.83 74.19 604.33 74.19C613.83 74.19 619.63 81.22 619.63 94.68C619.63 108.14 613.7 114.05 604.2 114.05ZM783 114.05C773.38 114.05 767.21 107.38 767.21 94.06C767.21 80.74 773.62 74.19 783.13 74.19C792.64 74.19 798.43 81.22 798.43 94.68C798.43 108.14 792.51 114.05 783.01 114.05H783ZM673.79 120.96H683.54V90.11C683.54 81.22 687.36 75.05 696.62 75.05C705.26 75.05 707.97 78.75 707.97 87.76V120.95H717.96V84.92C717.96 72.58 712.77 66.16 701.06 66.16C693.04 66.16 687.12 69.12 683.54 74.18L682.3 67.39H673.78V120.94L673.79 120.96ZM371.89 120.96H381.64V90.11C381.64 81.22 385.46 75.05 394.72 75.05C403.36 75.05 406.07 78.75 406.07 87.76V120.95H416.06V84.92C416.06 72.58 410.88 66.16 399.16 66.16C391.14 66.16 385.22 69.12 381.64 74.18L380.41 67.39H371.89V120.94V120.96ZM818.41 120.96H828.15V90.11C828.15 81.22 831.98 75.05 841.23 75.05C849.86 75.05 852.59 78.75 852.59 87.76V120.95H862.58V84.92C862.58 72.58 857.4 66.16 845.68 66.16C837.66 66.16 831.73 69.12 828.16 74.18L826.93 67.39H818.42V120.94L818.41 120.96ZM519.92 49.01V40.37H462.91V49.01H486.23V120.95H496.97V49.01H519.92ZM525.11 120.96H534.86V90.11C534.86 81.22 538.68 75.05 547.94 75.05C556.58 75.05 559.29 78.75 559.29 87.76V120.95H569.29V84.92C569.29 72.58 564.1 66.16 552.39 66.16C544.37 66.16 538.44 69.12 534.87 74.18V40.37H525.12V120.95L525.11 120.96ZM244.92 89H263.92V106.89C258.12 111.95 249.23 113.92 242.08 113.92C224.19 113.92 213.95 102.32 213.95 81.96C213.95 60.37 224.93 48.4 241.84 48.4C251.96 48.4 259.48 51.98 266.64 58.76L272.93 51.6C266.51 44.57 255.53 39.39 242.95 39.39C217.65 39.39 202.72 57.04 202.72 81.71C202.72 106.38 215.18 122.68 242.21 122.68C257.14 122.68 268.74 116.14 274.42 109.97V80.72H244.93V89H244.92ZM604.94 66.05C587.17 66.05 577.92 78.26 577.92 94.43C577.92 110.6 587.17 122.19 603.71 122.19C620.25 122.19 630.48 111.33 630.48 94.18C630.48 77.03 620.98 66.05 604.94 66.05ZM783.74 66.05C765.97 66.05 756.71 78.26 756.71 94.43C756.71 110.6 765.97 122.19 782.5 122.19C799.03 122.19 809.28 111.33 809.28 94.18C809.28 77.03 799.78 66.05 783.74 66.05Z" fill="#231F20"></path>
                <path d="M80.33 50.11C92.95 54.12 102.98 63.53 109.74 76.89C110.65 78.68 111.11 81.37 110.62 82.95C110.85 82.32 111.07 81.7 111.27 81.06C127.47 30.12 70.08 -4.01998 40.95 11.25C40.4 11.56 39.84 11.86 39.28 12.19C1.79 34.53 -10.83 82.65 10.52 120.45C-4.77 91.32 29.38 33.91 80.32 50.11H80.33Z" fill="url(#paint0_linear_1349_115)"></path>
                <path d="M49.39 81.0599C53.4 68.4399 62.81 58.3999 76.17 51.6499C77.96 50.7499 80.65 50.2799 82.23 50.7699C81.61 50.5399 80.98 50.3199 80.34 50.1199C29.4 33.9199 -4.75 91.3099 10.53 120.44C10.84 121 11.14 121.55 11.47 122.11C33.81 159.6 81.93 172.22 119.73 150.87C90.6 166.16 33.19 132.01 49.39 81.0699V81.0599Z" fill="url(#paint1_linear_1349_115)"></path>
                <path d="M80.34 112C67.72 107.99 57.69 98.5799 50.93 85.2199C50.03 83.4299 49.56 80.7399 50.05 79.1599C49.82 79.7799 49.6 80.4099 49.4 81.0499C33.2 131.99 90.59 166.14 119.72 150.86C120.27 150.55 120.84 150.25 121.39 149.92C158.88 127.58 171.5 79.4699 150.15 41.6599C165.44 70.7899 131.29 128.2 80.35 111.99L80.34 112Z" fill="url(#paint2_linear_1349_115)"></path>
                <path d="M111.28 81.06C107.27 93.68 97.86 103.72 84.5 110.47C82.71 111.38 80.02 111.84 78.44 111.35C79.06 111.58 79.69 111.8 80.33 112C131.27 128.2 165.41 70.8099 150.14 41.68C149.83 41.12 149.53 40.56 149.2 40.01C126.86 2.51995 78.74 -10.1 40.94 11.25C70.07 -4.04004 127.48 30.11 111.28 81.05V81.06Z" fill="url(#paint3_linear_1349_115)"></path>
                <defs>
                <linearGradient id="paint0_linear_1349_115" x1="113.88" y1="58.36" x2="-1.06" y2="66.4" gradientUnits="userSpaceOnUse">
                <stop stopColor="#522E91"></stop>
                <stop offset="0.12" stopColor="#522E91"></stop>
                <stop offset="0.31" stopColor="#6B4DA1"></stop>
                <stop offset="0.55" stopColor="#8870B3"></stop>
                <stop offset="0.74" stopColor="#9986BE"></stop>
                <stop offset="0.87" stopColor="#A08EC3"></stop>
                <stop offset="1" stopColor="#917DBA"></stop>
                </linearGradient>
                <linearGradient id="paint1_linear_1349_115" x1="57.64" y1="47.5099" x2="65.68" y2="162.45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#522E91"></stop>
                <stop offset="0.12" stopColor="#522E91"></stop>
                <stop offset="0.31" stopColor="#6B4DA1"></stop>
                <stop offset="0.55" stopColor="#8870B3"></stop>
                <stop offset="0.74" stopColor="#9986BE"></stop>
                <stop offset="0.87" stopColor="#A08EC3"></stop>
                <stop offset="1" stopColor="#917DBA"></stop>
                </linearGradient>
                <linearGradient id="paint2_linear_1349_115" x1="46.79" y1="103.76" x2="161.73" y2="95.7199" gradientUnits="userSpaceOnUse">
                <stop stopColor="#522E91"></stop>
                <stop offset="0.12" stopColor="#522E91"></stop>
                <stop offset="0.31" stopColor="#6B4DA1"></stop>
                <stop offset="0.55" stopColor="#8870B3"></stop>
                <stop offset="0.74" stopColor="#9986BE"></stop>
                <stop offset="0.87" stopColor="#A08EC3"></stop>
                <stop offset="1" stopColor="#917DBA"></stop>
                </linearGradient>
                <linearGradient id="paint3_linear_1349_115" x1="103.04" y1="114.6" x2="95" y2="-0.340037" gradientUnits="userSpaceOnUse">
                <stop stopColor="#522E91"></stop>
                <stop offset="0.12" stopColor="#522E91"></stop>
                <stop offset="0.31" stopColor="#6B4DA1"></stop>
                <stop offset="0.55" stopColor="#8870B3"></stop>
                <stop offset="0.74" stopColor="#9986BE"></stop>
                <stop offset="0.87" stopColor="#A08EC3"></stop>
                <stop offset="1" stopColor="#917DBA"></stop>
                </linearGradient>
                </defs>
                </svg>
              <div>
                
                <p className="text-sm text-gray-500">Assistant IA et Analyseur de Documents</p>
              </div>
            </div>
            <a
              href="https://www.linkedin.com/in/maguette-sall-87315a252/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Voir mon profil LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>


      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        <div 
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 px-4 sm:px-6 lg:px-8"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db transparent'
          }}
        >
          <div className="max-w-4xl mx-auto py-6 space-y-6 pb-32">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const isAssistant = message.role === 'assistant';
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group relative`}
                >
                  <div
                    className={`relative ${
                      isUser
                        ? 'max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] text-white rounded-3xl rounded-br-lg px-4 py-3'
                        : message.role === 'system'
                        ? 'max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] border rounded-2xl px-4 py-3'
                        : 'w-full text-gray-900 py-3 px-1 sm:px-2 lg:px-4'
                    }`}
                    style={
                      isUser
                        ? { background: '#8870B3' }
                        : message.role === 'system'
                        ? { background: '#F3F0F9', color: '#8870B3', borderColor: '#D6C9E6' }
                        : undefined
                    }
                  >
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                      {isAssistant
                        ? markdownToText(message.content)
                        : message.content}
                    </p>
                    {/* AI message copy button (below message) */}
                    {isAssistant && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="mt-1 bg-white/80 hover:bg-white rounded-full p-1 border border-gray-200 shadow text-gray-500"
                            style={{ zIndex: 2, color: copied === `ai-${index}` ? '#8870B3' : undefined }}
                            onClick={async () => {
                              await navigator.clipboard.writeText(message.content);
                              setCopied(`ai-${index}`);
                              setTimeout(() => setCopied(null), 1000);
                            }}
                            onMouseOver={e => (e.currentTarget.style.color = '#8870B3')}
                            onMouseOut={e => (e.currentTarget.style.color = copied === `ai-${index}` ? '#8870B3' : '#6B7280')}
                          >
                            {copied === `ai-${index}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copier</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {/* User message copy button (show on hover, below bubble) */}
                  {isUser && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white rounded-full p-1 border border-gray-200 shadow text-gray-500"
                          style={{ zIndex: 2, color: copied === `user-${index}` ? '#8870B3' : undefined }}
                          onClick={async () => {
                            await navigator.clipboard.writeText(message.content);
                            setCopied(`user-${index}`);
                            setTimeout(() => setCopied(null), 1000);
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#8870B3')}
                          onMouseOut={e => (e.currentTarget.style.color = copied === `user-${index}` ? '#8870B3' : '#6B7280')}
                        >
                          {copied === `user-${index}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copier</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-3xl rounded-bl-lg px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area - Fixed at bottom with proper spacing */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/0 ">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              
              <div
                className="relative flex items-center bg-white rounded-3xl border-2 shadow-lg transition-colors max-w-4xl mx-auto p-2"
                style={{ borderColor: '#D6C9E6' }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#8870B3';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#D6C9E6';
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#B6A1D6';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#D6C9E6';
                }}
              >

                {/* Upload Button or File Box */}
                {uploadedFile ? (
                  <div className="flex items-center bg-[#F3F0F9] border border-[#D6C9E6] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 animate-fade-in mr-1 sm:mr-2 min-w-0 max-w-[140px] sm:max-w-[220px]">
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" style={{ color: '#8870B3' }} />
                    <span className="truncate text-xs sm:text-sm font-medium flex-1 min-w-0" style={{ color: '#5B437A' }}>
                      {uploadedFile.name}
                    </span>
                    <div className="flex items-center ml-1 sm:ml-2 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={togglePreview}
                            className="p-0.5 sm:p-1 rounded hover:bg-[#E3D6F2] transition-colors"
                            style={{ color: '#B6A1D6' }}
                          >
                            {showPreview ? <X className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{showPreview ? "Fermer l'aperçu" : "Ouvrir l'aperçu"}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={removeFile}
                            className="ml-0.5 sm:ml-1 p-0.5 sm:p-1 rounded hover:bg-[#E3D6F2] transition-colors"
                            style={{ color: '#B6A1D6' }}
                          >
                            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upload PDF</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-shrink-0 p-3 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Télécharger PDF</p>
                    </TooltipContent>
                  </Tooltip>
                )}
      {/* PDF Preview Panel (right, full height, retractable) */}
      {pdfUrl && showPreview && (
        <div className={`fixed top-0 right-0 h-screen shadow-2xl z-50 transition-transform duration-300 translate-x-0`} style={{ width: '90vw', maxWidth: 420, background: 'linear-gradient(135deg, #F3F0F9 60%, #E3D6F2 100%)', borderTopLeftRadius: 24, borderBottomLeftRadius: 24, boxShadow: '0 4px 32px 0 rgba(136,112,179,0.13)', borderLeft: '1.5px solid #D6C9E6', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#E3D6F2] border-b border-[#D6C9E6]" style={{ borderTopLeftRadius: 24 }}>
            <span className="text-[#5B437A] font-semibold text-sm sm:text-base truncate">Aperçu du PDF</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={togglePreview}
                  className="p-2 rounded hover:bg-[#F3F0F9] transition-colors"
                  style={{ color: '#8870B3' }}
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fermer l'aperçu</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 flex flex-col bg-white" style={{ borderBottomLeftRadius: 24, overflow: 'hidden' }}>
            <iframe
              src={pdfUrl}
              title="Aperçu du PDF"
              width="100%"
              height="100%"
              style={{ border: 'none', background: '#fff', flex: 1 }}
              allowFullScreen
            />
          </div>
        </div>
      )}

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre question..."
                  className="flex-1 bg-transparent border-0 outline-none resize-none py-3 px-2 text-gray-900 placeholder-gray-500 text-sm sm:text-base max-h-[200px] min-h-[24px] focus:ring-0"
                  rows={1}
                  disabled={isLoading}
                  style={{ boxShadow: 'none' }}
                  onFocus={e => {
                    const parent = e.target.parentElement;
                    if (parent) parent.style.borderColor = '#8870B3';
                  }}
                  onBlur={e => {
                    const parent = e.target.parentElement;
                    if (parent) parent.style.borderColor = '#D6C9E6';
                  }}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 m-1 transition-all flex items-center justify-center rounded-full"
                  style={{
                    background: input.trim() ? '#8870B3' : isLoading ? "#E3D6F2" : '#E3D6F2',
                    color: '#fff',
                    width: isLoading ? 38 : 34,
                    height: isLoading ? 38 : 34,
                    opacity: isLoading ? 1 : (input.trim() ? 1 : 0.5),
                    transition: 'all 0.2s',
                    fontSize: 0,
                    padding: 0,
                  }}
                  onMouseOver={e => {
                    if (input.trim() && !isLoading) e.currentTarget.style.background = '#5B437A';
                  }}
                  onMouseOut={e => {
                    if (input.trim() && !isLoading) e.currentTarget.style.background = '#8870B3';
                  }}
                >
                  {isLoading ? (
                    <Square style={{ width: 20, height: 20 }} />
                  ) : (
                    <ArrowUp style={{ width: 20, height: 20  }} />
                  )}
                </button>
              </div>
              
              <p className="text-xs text-gray-400 mt-2 text-center px-4">
                PDF ou question sur Grant Thornton
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
}