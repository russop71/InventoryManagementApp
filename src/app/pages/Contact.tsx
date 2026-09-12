import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Mail, MapPin, Send } from 'lucide-react';

const SUPPORT_EMAIL = 'support@zestiq.ca';

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
    const body = [
      `Name: ${formData.name}`,
      `Reply email: ${formData.email}`,
      `Priority: ${formData.priority}`,
      '',
      formData.message,
    ].join('\n');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(body)}`;
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
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `mailto:${SUPPORT_EMAIL}`}>
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#FEF9C3] rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#0F172A]" />
              </div>
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-gray-600">{SUPPORT_EMAIL}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle>Prepare an Email</CardTitle>
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
              Open in Email App
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
            Zest IQ Inc.<br />
            5137 Oakley Drive<br />
            Burlington, Ontario L7L 6P1, Canada
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
