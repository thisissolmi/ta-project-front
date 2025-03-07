// SignatureOverlay.js
import { useEffect, useState } from "react";
import { useRecoilState } from "recoil";
import { signingState } from "../../recoil/atom/signingState";
import DraggableSignature from "../DraggableSignature";
import SignaturePopup from "./SignaturePopup";

const SignatureOverlay = ({currentPage}) => {
  const [signing, setSigning] = useRecoilState(signingState);
  const [selectedField, setSelectedField] = useState(null);
  const [signatureURL, setSignatureURL] = useState(null);
  const [hoveredField, setHoveredField] = useState(null);

  useEffect(() => {console.log(currentPage);console.log(signing);}, [currentPage,signing]);

  // 서명 입력 팝업 열기
  const openPopup = (fieldIndex) => {
    setSelectedField(fieldIndex);
  };

  // 서명 입력 팝업 닫기
  const closePopup = () => {
    setSelectedField(null);
  };

  // 서명 삭제하기 (서명 위치는 유지)
  const handleDeleteSignature = (index) => {
    setSigning((prev) => ({
      ...prev,
      signatureFields: prev.signatureFields.map((field, i) =>
        i === index ? { ...field, image: null } : field
      ),
    }));
  };

  return (
    <div>
      {signing.signatureFields
        .filter((field) => field.position.pageNumber === currentPage) // ✅ 현재 페이지에 해당하는 서명 필드만 표시
        .map((field, index) =>(
        <div
          key={index}
          style={{
            position: "absolute",
            left: field.position.x,
            top: field.position.y,
            width: field.width,
            height: field.height,
            border: field.image ? "none" : "2px dashed black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backgroundColor: field.image ? "transparent" : "#f8f9fa50", // 이미지가 있으면 투명, 없으면 반투명 배경
          }}
          onClick={() => openPopup(index)}
          onMouseEnter={() => setHoveredField(index)}
          onMouseLeave={() => setHoveredField(null)}
        >
          {field.type === 0 && field.image && (
            <img 
              src={field.image} 
              alt="서명" 
              style={{ 
                width: "100%", 
                height: "100%",
                objectFit: "contain",
                border: "2px solid black",
              }} 
            />
          )}
          {field.type === 1 && field.text && (
            <span style={{ fontSize: "16px", fontWeight: "bold" }}>{field.text}</span>
          )}
          {hoveredField === index && field.image && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSignature(index);
              }}
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                backgroundColor: "red",
                color: "white",
                border: "none",
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: "12px",
                borderRadius: "5px",
              }}
            >
              삭제
            </button>
          )}
        </div>
      ))}

      {/* 드래그 가능한 서명 */}
      {signatureURL && (
        <DraggableSignature
          url={signatureURL}
          onCancel={() => setSignatureURL(null)}
        />
      )}

      {/* 서명 입력 팝업 */}
      {selectedField !== null && (
        <SignaturePopup
          field={signing.signatureFields[selectedField]}
          fieldIndex={selectedField}
          onClose={closePopup}
        />
      )}
    </div>
  );
};

export default SignatureOverlay;
