import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ChevronRight, Search, Book, Video, MessageCircle, FileText, Lightbulb, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';

interface HelpArticle {
  id: string;
  title: string;
  category: string;
  icon: any;
  route: string;
}

export function Help() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { name: 'Getting Started', icon: Lightbulb, color: 'bg-[#FEF9C3] text-[#303A43]', articles: 5, route: '/app/onboarding' },
    { name: 'Inventory Management', icon: Book, color: 'bg-green-100 text-green-900', articles: 8, route: '/app/inventory' },
    { name: 'AI & Forecasting', icon: Zap, color: 'bg-purple-100 text-purple-900', articles: 6, route: '/app/forecasting' },
    { name: 'Integrations', icon: FileText, color: 'bg-orange-100 text-orange-900', articles: 4, route: '/app/integrations' }
  ];

  const popularArticles: HelpArticle[] = [
    { id: '1', title: 'How to connect or import from your POS', category: 'Integrations', icon: FileText, route: '/app/integrations' },
    { id: '2', title: 'Understanding par levels and reorder points', category: 'Inventory', icon: Book, route: '/app/inventory' },
    { id: '3', title: 'How AI forecasting works', category: 'AI & Forecasting', icon: Zap, route: '/app/forecasting' },
    { id: '4', title: 'Creating and managing recipes', category: 'Recipes', icon: Book, route: '/app/recipes' },
    { id: '5', title: 'Reading the cost breakdown report', category: 'Reports', icon: FileText, route: '/app/costs' },
    { id: '6', title: 'Managing user roles and permissions', category: 'Users', icon: Book, route: '/app/users' }
  ];

  const filteredArticles = popularArticles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Help Center</h2>
        <p className="text-sm text-gray-600 mt-1">Find answers and learn how to use zestIQ Solutions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          aria-label="Search help articles"
          placeholder="Search for help articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card role="button" tabIndex={0} aria-label="Contact support" className="cursor-pointer hover:bg-gray-50" onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate('/app/contact');
          }
        }} onClick={() => navigate('/app/contact')}>
          <CardContent className="pt-4 text-center">
            <MessageCircle className="w-8 h-8 mx-auto text-[#303A43] mb-2" />
            <p className="text-sm font-medium">Contact Support</p>
            <p className="text-xs text-gray-500 mt-1">Get help from our team</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 opacity-75">
          <CardContent className="pt-4 text-center">
            <Video className="w-8 h-8 mx-auto text-[#303A43] mb-2" />
            <p className="text-sm font-medium">Video Tutorials</p>
            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Browse by Category</h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <Card key={category.name} role="button" tabIndex={0} onClick={() => navigate(category.route)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') navigate(category.route); }} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-medium text-sm mb-1">{category.name}</h4>
                  <p className="text-xs text-gray-500">{category.articles} articles</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Popular Articles */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">
          {searchQuery ? 'Search Results' : 'Popular Articles'}
        </h3>
        <div className="space-y-2">
          {filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500 text-sm">No articles found</p>
              </CardContent>
            </Card>
          ) : (
            filteredArticles.map(article => {
              const Icon = article.icon;
              return (
                <Card key={article.id} role="button" tabIndex={0} onClick={() => navigate(article.route)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') navigate(article.route); }} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{article.title}</p>
                          <p className="text-xs text-gray-500">{article.category}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm">No public status page is available yet</span>
            </div>
            <button type="button" onClick={() => navigate('/app/contact')} className="text-sm text-[#303A43] hover:underline">
              Report an issue
            </button>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>App Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span className="font-medium">September 8, 2026</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
