import { Drawer, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import styled from "styled-components";
import EmailInputModal from "../components/SignPage/EmailInputModal";
import PDFViewer from "../components/SignPage/PDFViewer";
import SignatureOverlay from "../components/SignPage/SignatureOverlay";
import { signingState } from "../recoil/atom/signingState";
import ApiService from "../utils/ApiService";

function SignaturePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isValid, setIsValid] = useState(null);
  const [error, setError] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [signing, setSigning] = useRecoilState(signingState);
  const [currentPage, setCurrentPage] = useState(1); // 현재 표시 중인 페이지
  
  // 서명 필드 페이지별 그룹화
  const [signaturesByPage, setSignaturesByPage] = useState({});

  // 서명 필드가 변경될 때마다 페이지별로 그룹화
  useEffect(() => {
    if (signing.signatureFields && signing.signatureFields.length > 0) {
      const groupedByPage = {};
      
      signing.signatureFields.forEach((field, index) => {
        const pageNumber = field.position.pageNumber;
        if (!groupedByPage[pageNumber]) {
          groupedByPage[pageNumber] = [];
        }
        groupedByPage[pageNumber].push({...field, index});
      });
      
      setSignaturesByPage(groupedByPage);
    }
  }, [signing.signatureFields]);

  // ✅ 1. 토큰 유효성 검사
  useEffect(() => {
    if (!token) {
      setError("유효하지 않은 접근입니다.");
      return;
    }

    ApiService.checkSignatureToken(token)
      .then(() => {
        setIsValid(true);
        setShowEmailModal(true);
      })
      .catch((err) => {
        setIsValid(false);
        const errorMessage = err.response?.data?.message || "서명 요청 검증에 실패했습니다.";
        setError(errorMessage);
        alert(errorMessage);
      });

    console.log("전역 변수 signing:", signing);
  }, [token]);

  // ✅ 2. 이메일 인증 후 문서 + 서명 위치 불러오기
  const handleEmailSubmit = (inputEmail, setModalError) => {
    setSigning((prevState) => ({
      ...prevState,
      signerEmail: inputEmail,
    }));

    ApiService.validateSignatureRequest(token, inputEmail)
      .then((response) => {
        console.log("서명 요청 검증 결과:", response);

        setSigning((prevState) => ({
          ...prevState,
          documentId: response.documentId,
          documentName: response.documentName,
          signerName: response.signerName,
        }));

        // ✅ PDF 문서 불러오기
        return ApiService.fetchDocumentForSigning(response.documentId)
          .then((pdfResponse) => {
            setSigning((prevState) => ({
              ...prevState,
              fileUrl: URL.createObjectURL(new Blob([pdfResponse.data], { type: "application/pdf" })),
            }));
          })
          .then(() => {
            // ✅ 서명 필드 정보 불러오기 (PDF 로딩 후 실행)
            return ApiService.fetchSignatureFields(response.documentId, inputEmail);
          })
          .then((fieldsResponse) => {
            setSigning((prevState) => ({
              ...prevState,
              signatureFields: fieldsResponse.data,
            }));
            setShowEmailModal(false); // 성공시에만 모달 닫기
            console.log("서명 필드 정보:", fieldsResponse.data);
          });
      })
      .catch((err) => {
        console.error("서명 요청 검증 실패:", err);
        const errorMessage = err.response?.data?.message || "이메일 인증에 실패했습니다. 다시 시도해주세요.";
        setModalError(errorMessage); // 모달 내부 에러 메시지 설정
        alert(errorMessage);
        // 실패시 모달을 닫지 않음
      });
  };

  // 특정 페이지로 이동하는 함수
  const navigateToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleSubmitSignature = async () => {
    if (!signing.documentId || signing.signatureFields.length === 0) {
      alert("서명할 필드가 없습니다.");
      return;
    }
  
    console.log("🔹 서명 저장 시작, 현재 상태:", signing);
  
    try {
      let fileName = null;
  
      // ✅ 1. 서명 이미지 업로드 (서명 필드 중 첫 번째 이미지 필드를 업로드)
      const imageField = signing.signatureFields.find(field => field.type === 0 && field.image);
      if (imageField) {
        console.log("🔹 서명 이미지 업로드 시작...");
        
        // ✅ Base64 → Blob 변환
        const blob = await fetch(imageField.image).then(res => res.blob());
  
        // ✅ 서버에 업로드 요청 (절차적 단계 보장)
        fileName = await ApiService.uploadSignatureFile(blob, signing.signerEmail);
        
        console.log("✅ 서명 이미지 업로드 완료, fileName:", fileName);
      }
  
      // ✅ 2. 서명 데이터 생성 (업로드된 이미지 파일명 적용)
      const signerData = {
        email: signing.signerEmail,
        name: signing.signerName,
        signatureFields: signing.signatureFields.map(field => ({
          signerEmail: signing.signerEmail,
          type: field.type,
          width: field.width,
          height: field.height,
          position: field.position,
          imageName: field.type === 0 ? fileName : null, // ✅ 업로드된 파일명 적용
          textData: field.textData || null
        }))
      };
  
      console.log("🔹 최종 서명 데이터 생성 완료:", signerData);
  
      // ✅ 3. 서명 정보 저장 (절차적으로 업로드 완료 후 실행)
      console.log("🔹 서명 데이터 저장 시작...");
      await ApiService.saveSignatures(signing.documentId, signerData);
      console.log("✅ 서명 저장 완료!");
      alert("서명이 성공적으로 저장되었습니다!");
    } catch (error) {
      console.error("❌ 서명 저장 실패:", error);
      alert("서명 저장 중 오류 발생");
    }
  };

  return (
    <MainContainer>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {isValid === null && <LoadingMessage>로딩 중...</LoadingMessage>}

      {/* ✅ 이메일 모달 - isValid가 true이고 documentId가 없을 때 표시 */}
      {isValid && !signing.documentId && (
        <EmailInputModal 
          open={true} 
          onSubmit={handleEmailSubmit} 
          onClose={() => {}} // 닫기 버튼 비활성화
        />
      )}

      <ContentWrapper>
        <Container>
          {/* 사이드바 부분 */}
          {signing.documentId && (
            <StyledDrawer variant="permanent" anchor="left">
              <DrawerHeader>
                <StyledTitle variant="h6">서명 정보</StyledTitle>
                <Divider />
                <UserInfoSection>
                  <UserInfoItem>
                    <InfoLabel>이름:</InfoLabel>
                    <InfoValue>{signing.signerName}</InfoValue>
                  </UserInfoItem>
                  <UserInfoItem>
                    <InfoLabel>이메일:</InfoLabel>
                    <InfoValue>{signing.signerEmail}</InfoValue>
                  </UserInfoItem>
                  <UserInfoItem>
                    <InfoLabel>문서:</InfoLabel>
                    <InfoValue>{signing.documentName}</InfoValue>
                  </UserInfoItem>
                </UserInfoSection>
                <Divider />
                <StyledServTitle variant="h7">서명 위치 목록</StyledServTitle>
                <SignatureCountBadge>
                  총 {signing.signatureFields?.length || 0}개의 서명이 필요합니다
                </SignatureCountBadge>
                <Divider />
              </DrawerHeader>

              <List>
                {Object.entries(signaturesByPage).map(([pageNum, fields]) => (
                  <div key={pageNum}>
                    <PageHeader>
                      {parseInt(pageNum) === currentPage ? (
                        <CurrentPageLabel>{pageNum}페이지 (현재 보는 중)</CurrentPageLabel>
                      ) : (
                        <PageLabel onClick={() => navigateToPage(parseInt(pageNum))}>
                          {pageNum}페이지로 이동
                        </PageLabel>
                      )}
                      <SignatureBadge>{fields.length}개</SignatureBadge>
                    </PageHeader>
                    
                    {fields.map((field, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={
                            <SignatureFieldInfo>
                              <div>서명 #{idx + 1}</div>
                              <SignatureStatus>
                                {field.image || field.textData ? "완료" : "미완료"}
                              </SignatureStatus>
                            </SignatureFieldInfo>
                          }
                          secondary={`위치: (${Math.round(field.position.x)}, ${Math.round(field.position.y)})`}
                        />
                      </ListItem>
                    ))}
                    <PageDivider />
                  </div>
                ))}
              </List>
            </StyledDrawer>
          )}

          {/* PDF 및 서명 영역 표시 */}
          {signing.documentId && signing.fileUrl && (
            <DocumentSection>
              <DocumentContainer>
                <PDFViewer
                  pdfUrl={signing.fileUrl}
                  setCurrentPage={setCurrentPage}
                />
                <SignatureOverlay currentPage={currentPage} />
              </DocumentContainer>
              
              <ButtonContainer>
                <CompleteButton onClick={handleSubmitSignature}>서명 완료</CompleteButton>
              </ButtonContainer>
            </DocumentSection>
          )}
        </Container>
      </ContentWrapper>
    </MainContainer>
  );
}

// 스타일 컴포넌트
const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f5f5f5;
`;

const ContentWrapper = styled.div`
  flex: 1;
  margin-top: 80px;
`;

const Container = styled.div`
  margin: 0 auto;
  padding: 20px;
  position: relative;
`;

const DocumentSection = styled.div`
  margin-left: 250px;
  padding: 20px;
`;

const DocumentContainer = styled.div`
  max-width: 800px;
  margin: 20px auto;
  position: relative;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const DrawerHeader = styled.div`
  padding: 16px;
`;

const UserInfoSection = styled.div`
  margin: 10px 0;
  padding: 10px;
  background-color: #f8f8f8;
  border-radius: 4px;
`;

const UserInfoItem = styled.div`
  display: flex;
  margin-bottom: 5px;
`;

const InfoLabel = styled.span`
  font-weight: bold;
  width: 60px;
`;

const InfoValue = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f0f0f0;
  margin-top: 4px;
`;

const PageLabel = styled.span`
  cursor: pointer;
  color: #0066cc;
  &:hover {
    text-decoration: underline;
  }
`;

const CurrentPageLabel = styled.span`
  font-weight: bold;
  color: #333;
`;

const SignatureBadge = styled.span`
  background-color: #0066cc;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.8rem;
`;

const SignatureFieldInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SignatureStatus = styled.span`
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 10px;
  background-color: ${props => props.children === "완료" ? "#4CAF50" : "#ff9800"};
  color: white;
`;

const PageDivider = styled.hr`
  margin: 4px 0;
  border: none;
  border-top: 1px dashed #e0e0e0;
`;

const SignatureCountBadge = styled.div`
  margin: 10px 0;
  padding: 6px 10px;
  background-color: #e1f5fe;
  border-radius: 4px;
  color: #0277bd;
  font-size: 0.9rem;
  text-align: center;
`;

const Divider = styled.hr`
  margin: 10px 0;
  border: none;
  border-top: 1px solid #e0e0e0;
  width: 100%;
`;

const LoadingMessage = styled.p`
  text-align: center;
  padding: 20px;
  color: #666;
`;

const ErrorMessage = styled.p`
  text-align: center;
  padding: 20px;
  color: red;
  background-color: #ffebee;
  border-radius: 4px;
  margin: 20px;
`;

const ButtonContainer = styled.div`
  text-align: center;
  margin: 20px 0;
  padding: 20px;
`;

const ButtonBase = styled.button`
  padding: 12px 24px;
  color: white;
  border: none;
  border-radius: 25px;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const CompleteButton = styled(ButtonBase)`
  background-color: ${({ disabled }) => (disabled ? "#ccc" : "#03A3FF")};
  font-size: 1rem;
  font-weight: bold;
`;

const StyledDrawer = styled(Drawer)`
  && {
    width: 300px;
    flex-shrink: 0;
    
    .MuiDrawer-paper {
      width: 250px;
      top: 80px;
      height: calc(100% - 80px);
      background-color: white;
      border-right: 1px solid #e0e0e0;
    }
  }
`;

const StyledTitle = styled(Typography)`
  font-weight: bold;
  margin-bottom: 8px;
`;

const StyledServTitle = styled(Typography)`
  color: #666;
  font-size: 0.9rem;
  margin: 8px 0;
`;

export default SignaturePage;