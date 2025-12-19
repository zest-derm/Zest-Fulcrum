export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ArrowRight, Upload, FileText, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero Section with Orange Gradient */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              Biologic Decision Support System
            </h1>
            <p className="text-xl text-primary-50 max-w-3xl mx-auto">
              Select the next best biologic from your formulary with intelligent,
              tier-based recommendations and comorbidity matching
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        <div className="card card-hover transform transition-all duration-200 hover:-translate-y-1">
          <Upload className="w-12 h-12 text-primary-600 mb-4 transition-transform duration-200 group-hover:scale-110" />
          <h3 className="mb-2">Upload Data</h3>
          <p className="text-gray-600 mb-4">
            Upload formulary sheets, claims data, and clinical evidence through simple CSV/PDF uploads
          </p>
          <Link href="/admin" className="text-primary-600 hover:text-primary-700 font-medium flex items-center transition-all duration-150 group">
            Go to Admin <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="card card-hover transform transition-all duration-200 hover:-translate-y-1">
          <FileText className="w-12 h-12 text-primary-600 mb-4 transition-transform duration-200 group-hover:scale-110" />
          <h3 className="mb-2">Quick Assessment</h3>
          <p className="text-gray-600 mb-4">
            Simplified patient assessment form with automatic data population and tier-based recommendations
          </p>
          <Link href="/assess" className="text-primary-600 hover:text-primary-700 font-medium flex items-center transition-all duration-150 group">
            Start Assessment <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="card card-hover transform transition-all duration-200 hover:-translate-y-1">
          <BarChart3 className="w-12 h-12 text-primary-600 mb-4 transition-transform duration-200 group-hover:scale-110" />
          <h3 className="mb-2">Data Room</h3>
          <p className="text-gray-600 mb-4">
            View provider decisions, AI recommendation acceptance rates, and detailed analytics by diagnosis and remission status
          </p>
          <Link href="/data-room" className="text-primary-600 hover:text-primary-700 font-medium flex items-center transition-all duration-150 group">
            Access Data Room <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="card card-hover transform transition-all duration-200 hover:-translate-y-1">
          <Upload className="w-12 h-12 text-primary-600 mb-4 transition-transform duration-200 group-hover:scale-110" />
          <h3 className="mb-2">Manage Data</h3>
          <p className="text-gray-600 mb-4">
            Upload and manage formulary data, insurance plans, and clinical knowledge base
          </p>
          <Link href="/admin/data" className="text-primary-600 hover:text-primary-700 font-medium flex items-center transition-all duration-150 group">
            Manage Data <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <div className="card max-w-3xl mx-auto">
        <h2 className="mb-4">How It Works</h2>
        <ol className="space-y-4">
          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold mr-4">
              1
            </span>
            <div>
              <h4 className="font-semibold mb-1">Input Patient Assessment</h4>
              <p className="text-gray-600">
                Select partner, enter current biologic (if any), diagnosis, comorbidities (PsA, BMI), and inappropriate biologics
              </p>
            </div>
          </li>
          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold mr-4">
              2
            </span>
            <div>
              <h4 className="font-semibold mb-1">Intelligent Filtering & Ranking</h4>
              <p className="text-gray-600">
                System filters formulary by tier, matches comorbidities (PsA, asthma, IBD), and ranks by efficacy
              </p>
            </div>
          </li>
          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold mr-4">
              3
            </span>
            <div>
              <h4 className="font-semibold mb-1">Tier-Based Recommendations</h4>
              <p className="text-gray-600">
                Receive 3 ranked options prioritizing lowest tier, with clinical rationale and cost analysis
              </p>
            </div>
          </li>
        </ol>
      </div>
      </div>
    </div>
  );
}
