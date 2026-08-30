# ZestIQ App Store submission

## Native app identity

- App name: **ZestIQ**
- Bundle ID: **ca.zestiq.app**
- Version: **1.0**
- Build: **1**
- Platforms: iPhone and iPad
- Minimum iOS version: iOS 15

## Build and TestFlight

1. Install Xcode from the Mac App Store and open it once to finish setup.
2. Run `npm run build:ios` from the project folder.
3. Run `npm run ios:open`.
4. In Xcode, select the **App** target, then **Signing & Capabilities**.
5. Select the ZestIQ Apple Developer team and leave automatic signing enabled.
6. Select **Any iOS Device (arm64)**, then use **Product > Archive**.
7. In Organizer, choose **Distribute App > App Store Connect > Upload**.
8. In App Store Connect, add the build to TestFlight and complete internal testing before submitting for review.

## App Store Connect information still required

- Subtitle, promotional text, description, keywords, and support URL
- Privacy policy URL: `https://zestiq.ca/privacy`
- Support URL: `https://zestiq.ca/contact`
- iPhone and iPad screenshots
- App Review contact details and a working review account
- App Privacy answers covering account data, restaurant operational data, diagnostics, camera/photo uploads, and location-based forecasting
- Pricing: free download for existing ZestIQ business customers; subscriptions are contracted outside the app

## Review notes

ZestIQ is a companion business operations app for existing restaurant customers. It provides inventory counting, invoice and recipe capture, purchasing, food and beverage costing, labour tools, and operational reporting. The iOS app does not sell or unlock subscriptions inside the app.

