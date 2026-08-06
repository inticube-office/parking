import React, { useState } from 'react';
import { Header } from './components/Header';
import { StepIndicator } from './components/StepIndicator';
import { SearchStep } from './components/SearchStep';
import { RegisterStep } from './components/RegisterStep';
import { DoneStep } from './components/DoneStep';
import { AdminLogsView } from './components/AdminLogsView';
import { CarSearchResult } from './types';

export function App() {
  const [step, setStep] = useState<number>(1);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);

  const [selectedCar, setSelectedCar] = useState<CarSearchResult | null>(null);
  const [searchedNo, setSearchedNo] = useState<string>('');
  const [summary, setSummary] = useState<{
    carNo: string;
    discountLabel: string;
    company: string;
  } | null>(null);

  const handleSelectCar = (car: CarSearchResult, carLast4: string) => {
    setSelectedCar(car);
    setSearchedNo(carLast4);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSearch = () => {
    setSelectedCar(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegisterSuccess = (resSummary: {
    carNo: string;
    discountLabel: string;
    company: string;
  }) => {
    setSummary(resSummary);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextCar = () => {
    setSelectedCar(null);
    setSearchedNo('');
    setSummary(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#F6F7F9] min-h-screen font-sans text-[#15171C]">
      {/* Shell Container: max-w 440px centered */}
      <div className="max-w-[440px] mx-auto min-h-screen bg-white shadow-sm flex flex-col justify-between">
        <div>
          {/* Header */}
          <Header showAdmin={showAdmin} setShowAdmin={setShowAdmin} />

          {/* Steps Indicator (Only when in registration flow) */}
          {!showAdmin && <StepIndicator currentStep={step} />}

          {/* Main Content */}
          <main className="p-5.5 pt-5 pb-10">
            {showAdmin ? (
              <AdminLogsView />
            ) : (
              <>
                {step === 1 && <SearchStep onSelectCar={handleSelectCar} />}
                {step === 2 && selectedCar && (
                  <RegisterStep
                    selectedCar={selectedCar}
                    searchedNo={searchedNo}
                    onBackToSearch={handleBackToSearch}
                    onSuccess={handleRegisterSuccess}
                  />
                )}
                {step === 3 && summary && (
                  <DoneStep summary={summary} onNext={handleNextCar} />
                )}
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="px-5 pb-8 text-[11.5px] text-[#A6ACB6] text-center">
          INTICUBE · 누리꿈스퀘어 방문객 주차 할인권
        </footer>
      </div>
    </div>
  );
}

export default App;
