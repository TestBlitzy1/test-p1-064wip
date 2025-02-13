# **Prompt for Sales and Intelligence Platform**

## **WHY - Vision & Purpose**

### **Purpose & Users**

**What problem are you solving and for whom?**

The platform automates and optimizes the process of creating ready-to-use campaign structures for [LinkedIn Ads](https://www.linkedin.com/) and [Google Ads](https://business.google.com/in/google-ads/) using AI.

- **What does your application do?**  
  The platform analyzes sales intelligence data and automatically generates tailored ad campaign structures for [LinkedIn Ads](https://www.linkedin.com/) and [Google Ads](https://business.google.com/in/google-ads/), reducing manual effort and enhancing targeting accuracy.

- **Who will use it?**

  - B2B Marketers

  - Performance Marketing Teams

  - Growth Hackers

  - Demand Generation Specialists

  - Digital Agencies

- **Why will they use it instead of alternatives?**

  - AI-driven insights improve campaign efficiency and precision.

  - Automates audience segmentation and ad copy generation.

  - Reduces time spent on campaign setup by up to 80%.

  - Seamlessly integrates with LinkedIn Ads Manager and Google Ads.

  - Ensures data-backed recommendations for campaign optimization.

----------

## **WHAT - Core Requirements**

### **Functional Requirements**

**System must:**

- **Campaign Generation:**

  - Automatically create ready-to-use campaign structures for [LinkedIn Ads](https://www.linkedin.com/) and [Google Ads](https://business.google.com/in/google-ads/).

  - Generate ad copies, headlines, descriptions, and CTA recommendations.

  - Provide keyword recommendations based on audience targeting.

- **Audience Segmentation:**

  - Use AI to analyze customer data and generate precise audience segments.

  - Identify high-converting personas based on past performance data.

  - Recommend targeting options, including job titles, industries, company sizes, and interests.

- **Competitive Analysis:**

  - Extract and analyze competitor ad strategies.

  - Provide insights on successful ad creatives, keywords, and bidding strategies.

- **Budget Optimization & Bidding Strategies:**

  - Recommend budget allocation across campaigns.

  - Suggest automated bidding strategies to maximize ROAS.

- **Ad Performance Prediction:**

  - Predict CTR, CPC, and conversion rates before the campaign launch.

  - Use historical data and AI models to estimate ad success.

- **A/B Testing Recommendations:**

  - Suggest variations of ad creatives for testing.

  - Identify top-performing ads based on AI-driven predictions.

- **Reporting & Insights:**

  - Provide real-time analytics dashboards.

  - Offer campaign improvement suggestions.

  - Automate campaign performance reports.

----------

## **HOW - Planning & Implementation**

### **Technical Implementation**

#### **Required Stack Components**

- **Frontend:**

  - Web-based application (React.js / Next.js for UI).

- **Backend:**

  - Python (Django/FastAPI) for AI processing and API handling.

- **Integrations:**

  - LinkedIn Ads API

  - Google Ads API

  - CRM & Sales Intelligence Platforms (HubSpot, Salesforce, Zoho, LinkedIn Sales Navigator)

  - Data Enrichment (Clearbit, ZoomInfo)

- **Infrastructure:**

  - Cloud-based deployment (AWS/GCP/Azure).

  - Database (PostgreSQL / MongoDB).

  - AI/ML models hosted on cloud-based inference servers.

#### **System Requirements**

- **Performance Needs:**

  - Real-time ad generation within seconds.

  - High availability for large-scale campaign execution.

- **Security Requirements:**

  - OAuth-based authentication for LinkedIn & Google Ads integrations.

  - Data encryption (at rest & in transit).

  - GDPR & CCPA compliance.

- **Scalability Expectations:**

  - Support for thousands of concurrent campaign generations.

  - Elastic scaling for AI processing workloads.

- **Reliability Targets:**

  - 99.9% uptime with automated failover systems.

  - Real-time error monitoring & logging.

- **Integration Constraints:**

  - Must comply with LinkedIn and Google Ads API rate limits.

  - Must sync seamlessly with CRM and analytics tools.

----------

## **User Experience**

### **Key User Flows**

1. **Campaign Creation Flow:**

   - User connects LinkedIn Ads/Google Ads account.

   - Uploads audience data or selects predefined targeting.

   - AI generates campaign structure, ad copies, and budget suggestions.

   - User reviews and customizes campaign elements.

   - One-click deployment to ad platforms.

2. **Audience Segmentation Flow:**

   - AI scans historical data or CRM inputs.

   - Suggests audience clusters based on conversion likelihood.

   - User selects or refines suggested audience segments.

3. **Ad Performance Prediction Flow:**

   - AI forecasts expected CTR, CPC, and ROI based on historical trends.

   - Provides recommendations for ad variations and bid adjustments.

4. **Reporting & Optimization Flow:**

   - User accesses a dashboard with real-time campaign performance.

   - AI provides automated insights and improvement suggestions.

   - User implements suggested changes with one click.

### **Core Interfaces**

- **Dashboard:**

  - Unified view of all campaigns, performance metrics, and recommendations.

- **Campaign Builder:**

  - Step-by-step interface for AI-generated ad setup and customization.

- **Audience Insights Panel:**

  - Visual segmentation and targeting recommendations.

- **Performance Prediction Module:**

  - AI-driven forecasts and suggestions.

- **Reports & Analytics:**

  - Real-time monitoring, A/B test results, and improvement insights.

----------

## **Business Requirements**

### **Access & Authentication**

- **User Types:**

  - Admin (Full access to all features)

  - Marketer (Can create and manage campaigns)

  - Analyst (Read-only access to reports & insights)

- **Authentication Requirements:**

  - OAuth-based login with LinkedIn/Google.

  - Role-based access control.

- **Access Control Needs:**

  - Multi-user permissions for agency use cases.

### **Business Rules**

- **Data Validation Rules:**

  - Ads must comply with LinkedIn and Google Ads policies.

  - AI-generated recommendations must be reviewed before publishing.

- **Process Requirements:**

  - Campaigns must be reviewed before launch.

  - AI must use anonymized data for training models.

- **Compliance Needs:**

  - Must align with GDPR & CCPA for data privacy.

- **Service Level Expectations:**

  - AI-generated campaigns should be ready within 30 seconds.

  - The platform should guarantee 99.9% uptime.

----------

## **Implementation Priorities**

### **High Priority:**

- AI-powered campaign generation

- Automated audience segmentation

- Ad copy and keyword recommendation engine

- LinkedIn & Google Ads API integration

- Performance prediction model

### **Medium Priority:**

- Competitive ad analysis

- Budget optimization engine

- CRM integration (HubSpot, Salesforce)

### **Lower Priority:**

- A/B testing automation

- Multi-user collaboration tools

----------

## **Key Prompting Principles**

### 1. **Focus on What Matters**

- AI-driven campaign generation & audience targeting.

- Seamless LinkedIn & Google Ads integration.

- Automated performance insights & recommendations.

### 2. **Give Context**

- Why marketers need automation in ad creation.

- The role of AI in campaign optimization.

- The pain points of traditional ad setup.

### 3. **Be Concise**

- Clearly define features without unnecessary details.

- Prioritize must-have functionality.

### 4. **Enhance with Templates**

- Include AI-generated ad copy examples.

- Provide a sample user journey walkthrough.

### 5. **Make It Yours**

- Customize based on business goals.

- Add additional integrations if needed.