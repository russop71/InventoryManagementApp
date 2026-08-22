import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Mail, Phone, MessageSquare, Clock, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    priority: 'normal'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent! We\'ll get back to you within 24 hours.');
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: '',
      priority: 'normal'
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Contact Us</h2>
        <p className="text-sm text-gray-600 mt-1">Get in touch with our support team</p>
      </div>

      {/* Contact Methods */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = 'mailto:support@86d.com'}>
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#FEF9C3] rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#0F172A]" />
              </div>
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-gray-600">support@86d.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = 'tel:+15551234567'}>
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Phone className="w-6 h-6 text-green-900" />
              </div>
              <div>
                <p className="font-medium">Phone Support</p>
                <p className="text-sm text-gray-600">(555) 123-4567</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => toast.info('Live chat coming soon!')}>
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-900" />
              </div>
              <div>
                <p className="font-medium">Live Chat</p>
                <p className="text-sm text-gray-600">Chat with our team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Support Hours</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Monday - Friday</span>
            <span className="font-medium">8:00 AM - 8:00 PM EST</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Saturday - Sunday</span>
            <span className="font-medium">10:00 AM - 6:00 PM EST</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Emergency support available 24/7 for critical issues
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send us a Message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Your name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="low">Low - General inquiry</option>
                <option value="normal">Normal - Standard support</option>
                <option value="high">High - Urgent issue</option>
                <option value="critical">Critical - System down</option>
              </select>
            </div>

            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder="Brief description of your issue"
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                placeholder="Please provide details about your question or issue..."
                rows={6}
              />
            </div>

            <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white">
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Office Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>Office Location</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            ZestIQ<br />
            Canadian-owned, serving restaurant operators across Canada<br />
            demo@zestiq.ca
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
