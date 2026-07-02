import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Shield } from 'lucide-react';

export function Privacy() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Privacy Policy</h2>
        <p className="text-sm text-gray-600 mt-1">Last updated: March 27, 2026</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Your Privacy Matters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-4">
          <section>
            <h3 className="font-semibold text-gray-900 mb-2">1. Information We Collect</h3>
            <p className="text-sm text-gray-600 mb-2">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Account information (name, email, restaurant name)</li>
              <li>Payment information (processed securely through our payment provider)</li>
              <li>Inventory data and usage patterns</li>
              <li>Sales data from integrated POS systems</li>
              <li>Communication preferences and support requests</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">2. How We Use Your Information</h3>
            <p className="text-sm text-gray-600 mb-2">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Generate AI-powered inventory forecasts and recommendations</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">3. Data Security</h3>
            <p className="text-sm text-gray-600">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption of data in transit and at rest, regular security assessments, and strict access controls.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">4. Data Sharing</h3>
            <p className="text-sm text-gray-600 mb-2">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>With your consent or at your direction</li>
              <li>With service providers who assist in our operations (under strict confidentiality agreements)</li>
              <li>To comply with legal obligations or protect rights and safety</li>
              <li>In connection with a merger, sale, or acquisition (with notice to you)</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">5. Third-Party Integrations</h3>
            <p className="text-sm text-gray-600">
              When you connect third-party services like Toast POS, we receive data from these platforms as necessary to provide our services. Your use of third-party integrations is subject to their respective privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">6. Data Retention</h3>
            <p className="text-sm text-gray-600">
              We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your data at any time, subject to legal retention requirements.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">7. Your Rights</h3>
            <p className="text-sm text-gray-600 mb-2">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Access, update, or delete your personal information</li>
              <li>Object to processing of your personal information</li>
              <li>Request restriction of processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">8. Cookies and Tracking</h3>
            <p className="text-sm text-gray-600">
              We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">9. Children's Privacy</h3>
            <p className="text-sm text-gray-600">
              Our Service is not intended for use by children under the age of 18. We do not knowingly collect personal information from children under 18.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">10. International Data Transfers</h3>
            <p className="text-sm text-gray-600">
              Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">11. Changes to This Policy</h3>
            <p className="text-sm text-gray-600">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">12. Contact Us</h3>
            <p className="text-sm text-gray-600">
              If you have any questions about this Privacy Policy, please contact us at privacy@86d.com or call (555) 123-4567.
            </p>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-gray-500 text-center">
            Your privacy is important to us. We are committed to protecting your personal information and being transparent about our data practices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
