import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FileText } from 'lucide-react';

export function Terms() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Terms of Service</h2>
        <p className="text-sm text-gray-600 mt-1">Last updated: March 27, 2026</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Terms & Conditions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-4">
          <section>
            <h3 className="font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h3>
            <p className="text-sm text-gray-600">
              By accessing and using 86'D Solutions ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">2. Use License</h3>
            <p className="text-sm text-gray-600 mb-2">
              Permission is granted to temporarily access the Service for personal, non-transferable use only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose</li>
              <li>Attempt to decompile or reverse engineer any software</li>
              <li>Remove any copyright or proprietary notations</li>
              <li>Transfer the materials to another person</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">3. User Account</h3>
            <p className="text-sm text-gray-600">
              To access certain features of the Service, you must register for an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">4. Data Accuracy</h3>
            <p className="text-sm text-gray-600">
              While we strive to provide accurate inventory forecasting and AI-powered recommendations, you acknowledge that the Service's predictions are estimates and should be used as guidance only. You are responsible for verifying all orders and inventory decisions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">5. Third-Party Integrations</h3>
            <p className="text-sm text-gray-600">
              The Service may integrate with third-party services such as Toast POS. You acknowledge that your use of these integrations is subject to the respective third-party's terms of service and privacy policies.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">6. Payment Terms</h3>
            <p className="text-sm text-gray-600">
              Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to change our pricing with 30 days notice.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">7. Termination</h3>
            <p className="text-sm text-gray-600">
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">8. Limitation of Liability</h3>
            <p className="text-sm text-gray-600">
              In no event shall 86'D Solutions or its suppliers be liable for any damages arising out of the use or inability to use the Service, even if 86'D Solutions has been notified of the possibility of such damages.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">9. Governing Law</h3>
            <p className="text-sm text-gray-600">
              These Terms shall be governed and construed in accordance with the laws of the State of New York, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">10. Changes to Terms</h3>
            <p className="text-sm text-gray-600">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">11. Contact Information</h3>
            <p className="text-sm text-gray-600">
              If you have any questions about these Terms, please contact us at legal@86d.com or call (555) 123-4567.
            </p>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-gray-500 text-center">
            By using 86'D Solutions, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
