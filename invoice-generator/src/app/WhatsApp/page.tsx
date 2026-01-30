'use client';

import React, { useState, useEffect } from 'react';
import { Tables } from '@/types/supabase';

type WhatsAppMessage = Tables<'whatsapp_messages'>;
type Contact = Tables<'contacts'>;

interface GroupedMessages {
  [contactId: string]: WhatsAppMessage[];
}

const WhatsAppPage = () => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<GroupedMessages>({});
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    contact: '',
    company_name: '',
    User_name: '',
    contactId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both messages and contacts
      const [messagesRes, contactsRes] = await Promise.all([
        fetch('/api/whatsapp'),
        fetch('/api/contacts')
      ]);

      if (!messagesRes.ok) {
        throw new Error(`Failed to fetch messages: ${messagesRes.status}`);
      }
      if (!contactsRes.ok) {
        throw new Error(`Failed to fetch contacts: ${contactsRes.status}`);
      }
      
      const messagesData: WhatsAppMessage[] = await messagesRes.json();
      const contactsData: Contact[] = await contactsRes.json();
      
      setMessages(messagesData);
      setContacts(contactsData);
      
      // Create a Set of contactIds from the contacts table
      const validContactIds = new Set(
        contactsData.map(c => c.contactId).filter(Boolean)
      );
      
      // Filter messages to only include those with contactIds in the contacts table
      const filteredMessages = messagesData.filter(msg => 
        msg.contactId && validContactIds.has(msg.contactId)
      );
      
      // Group filtered messages by contactId
      const grouped = filteredMessages.reduce((acc: GroupedMessages, msg) => {
        const contactId = msg.contactId || 'Unknown';
        if (!acc[contactId]) {
          acc[contactId] = [];
        }
        acc[contactId].push(msg);
        return acc;
      }, {});
      
      setGroupedMessages(grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = async (contactId: string) => {
    const isOpening = selectedContact !== contactId;
    setSelectedContact(selectedContact === contactId ? null : contactId);
    
    // Mark messages as read when opening a contact
    if (isOpening) {
      try {
        await fetch('/api/whatsapp/mark-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contactId }),
        });
        
        // Update local state to mark messages as read
        setGroupedMessages(prev => {
          const updated = { ...prev };
          if (updated[contactId]) {
            updated[contactId] = updated[contactId].map(msg => ({
              ...msg,
              read: true
            }));
          }
          return updated;
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contact) {
      alert('Contact is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to add contact');
      }

      // Reset form and close modal
      setFormData({
        contact: '',
        company_name: '',
        User_name: '',
        contactId: ''
      });
      setShowModal(false);
      
      // Refresh data
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to add contact');
      console.error('Error adding contact:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const getContactInfo = (contactId: string): Contact | undefined => {
    return contacts.find(c => c.contactId === contactId);
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-medium text-white/70">Loading messages...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 min-h-screen bg-[var(--background)] flex items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-md w-full">
           <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
           <h2 className="text-xl font-bold text-white mb-2">Error Occurred</h2>
           <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const contactIds = Object.keys(groupedMessages);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[var(--background)] transition-all duration-300">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 lg:p-12">
        <header className="mb-10 flex justify-between items-start">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              WhatsApp <span className="text-[var(--accent)]">Messages</span>
            </h1>
            <p className="text-white/40 mt-3 text-lg">Central hub for all incoming WhatsApp communications</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Contact
          </button>
        </header>
        
        {contactIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm">
            <svg className="w-20 h-20 text-white/10 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-white/30 text-xl font-medium mb-2">No contacts found</p>
            <p className="text-white/20 text-sm">Add a contact to get started!</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {contactIds.map((contactId) => {
              const contactMessages = groupedMessages[contactId];
              const messageCount = contactMessages.length;
              const unreadCount = contactMessages.filter(msg => !(msg as any).read).length;
              const isSelected = selectedContact === contactId;
              const contactInfo = getContactInfo(contactId);
              
              return (
                <div 
                  key={contactId} 
                  className={`
                    group overflow-hidden rounded-2xl border transition-all duration-300
                    ${isSelected 
                      ? 'bg-white/5 border-[var(--accent)] shadow-[0_0_30px_rgba(234,88,12,0.15)] ring-1 ring-[var(--accent)]/30' 
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'}
                  `}
                >
                  {/* Contact Header */}
                  <div
                    onClick={() => handleContactClick(contactId)}
                    className="p-5 sm:p-6 cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                       <div className={`
                         relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300
                         ${isSelected ? 'bg-[var(--accent)] text-white scale-110' : 'bg-white/10 text-white/60'}
                       `}>
                         {(contactInfo?.company_name || contactId).slice(0, 2).toUpperCase()}
                         {unreadCount > 0 && !isSelected && (
                           <div className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-black shadow-lg">
                             {unreadCount}
                           </div>
                         )}
                       </div>
                       <div>
                         <div className="flex items-center gap-2">
                           <h2 className={`text-xl sm:text-2xl font-bold transition-colors ${isSelected ? 'text-[var(--accent)]' : 'text-white'}`}>
                             {contactInfo?.company_name || 'Unknown Company'}
                           </h2>
                           {unreadCount > 0 && (
                             <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                               {unreadCount} new
                             </span>
                           )}
                         </div>
                         <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {contactInfo?.User_name && (
                              <span className="text-xs text-white/50">
                                <span className="font-semibold">Contact Person:</span> {contactInfo.User_name}
                              </span>
                            )}
                            {contactInfo?.contact && (
                              <span className="text-xs text-white/50">
                                <span className="font-semibold">Phone:</span> {contactInfo.contact}
                              </span>
                            )}
                            {!contactInfo?.company_name && (
                              <span className="text-xs text-white/40 italic">
                                ID: {contactId}
                              </span>
                            )}
                         </div>
                         <div className="flex items-center gap-2 mt-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[var(--accent)]' : 'bg-white/20'}`}></span>
                            <p className="text-sm font-medium text-white/40 uppercase tracking-widest">
                              {messageCount} message{messageCount !== 1 ? 's' : ''}
                            </p>
                         </div>
                       </div>
                    </div>
                    
                    <div className={`
                      p-2 rounded-xl border border-white/10 transition-all duration-300
                      ${isSelected ? 'bg-[var(--accent)] border-transparent rotate-180' : 'bg-white/5 group-hover:bg-white/10'}
                    `}>
                      <svg
                        className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-white/40'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Messages Section - Chatbox Style */}
                  <div className={`
                    overflow-hidden transition-all duration-500 ease-in-out
                    ${isSelected ? 'max-h-[800px] opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}
                  `}>
                    <div className="p-4 sm:p-6 bg-gradient-to-b from-white/[0.02] to-transparent">
                      {/* Chat Container */}
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {contactMessages.map((msg, index) => {
                          const currentDate = msg.created_at ? new Date(msg.created_at).toLocaleDateString() : null;
                          const previousDate = index > 0 && contactMessages[index - 1].created_at 
                            ? new Date(contactMessages[index - 1].created_at!).toLocaleDateString() 
                            : null;
                          const showDateHeader = currentDate && currentDate !== previousDate;
                          
                          // Check if message is an image URL
                          const isImageUrl = msg.message && (
                            msg.message.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ||
                            msg.message.startsWith('http') && msg.message.includes('image')
                          );

                          return (
                            <div key={msg.id}>
                              {/* Date Header */}
                              {showDateHeader && (
                                <div className="flex items-center justify-center my-6">
                                  <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
                                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                                      {currentDate}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Message Bubble */}
                              <div className="flex items-end gap-3 animate-fadeIn">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-[var(--accent)]">
                                    {(contactInfo?.company_name || contactId).slice(0, 1).toUpperCase()}
                                  </span>
                                </div>
                                
                                {/* Message Content */}
                                <div className="flex-1 max-w-[80%]">
                                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm p-4 backdrop-blur-sm hover:bg-white/[0.07] transition-all duration-200 group">
                                    {/* Message Text or Image */}
                                    {isImageUrl ? (
                                      <div className="space-y-2">
                                        <img 
                                          src={msg.message || ''} 
                                          alt="Shared image" 
                                          className="rounded-xl max-w-full h-auto border border-white/10"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling;
                                            if (fallback) fallback.classList.remove('hidden');
                                          }}
                                        />
                                        <div className="hidden text-sm text-white/60 italic">
                                          Failed to load image: {msg.message}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-white/80 leading-relaxed break-words">
                                        {msg.message || <span className="text-white/30 italic">No content</span>}
                                      </p>
                                    )}
                                    
                                    {/* Timestamp */}
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                      <span className="text-[10px] text-white/30 font-mono">
                                        {msg.created_at
                                          ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                          : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[var(--background)] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative animate-slideUp">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Add New Contact</h2>
            <p className="text-white/40 mb-6">Register a new contact to track their WhatsApp messages</p>
            
            <form onSubmit={handleAddContact} className="space-y-5">
              <div>
                <label htmlFor="contact" className="block text-sm font-semibold text-white/60 mb-2">
                  Contact <span className="text-[var(--accent)]">*</span>
                </label>
                <input
                  type="text"
                  id="contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="Enter contact number"
                />
              </div>
              
              <div>
                <label htmlFor="company_name" className="block text-sm font-semibold text-white/60 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="Enter company name"
                />
              </div>
              
              <div>
                <label htmlFor="User_name" className="block text-sm font-semibold text-white/60 mb-2">
                  User Name
                </label>
                <input
                  type="text"
                  id="User_name"
                  name="User_name"
                  value={formData.User_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="Enter user name"
                />
              </div>
              
              <div>
                <label htmlFor="contactId" className="block text-sm font-semibold text-white/60 mb-2">
                  Contact ID
                </label>
                <input
                  type="text"
                  id="contactId"
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="Enter WhatsApp contact ID"
                />
              </div>
              
              <div className="flex gap-3 mt-8 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-white/10 text-white/70 rounded-xl hover:bg-white/5 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {submitting ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;
