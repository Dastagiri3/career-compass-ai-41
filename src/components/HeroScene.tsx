import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Torus, Icosahedron } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Mesh } from "three";

function FloatingShapes() {
  const groupRef = useRef<any>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={1.2} floatIntensity={1.5}>
        <Sphere args={[1.1, 64, 64]} position={[0, 0, 0]}>
          <MeshDistortMaterial
            color="#3b82f6"
            distort={0.45}
            speed={2.2}
            roughness={0.1}
            metalness={0.6}
          />
        </Sphere>
      </Float>

      <Float speed={1.4} rotationIntensity={2} floatIntensity={1.2}>
        <Torus args={[0.45, 0.14, 32, 64]} position={[2.1, 0.6, -0.5]}>
          <meshStandardMaterial color="#6366f1" metalness={0.7} roughness={0.2} />
        </Torus>
      </Float>

      <Float speed={1.8} rotationIntensity={1.6} floatIntensity={1.4}>
        <Icosahedron args={[0.5, 0]} position={[-2.2, -0.4, 0]}>
          <meshStandardMaterial color="#8b5cf6" metalness={0.5} roughness={0.25} flatShading />
        </Icosahedron>
      </Float>

      <Float speed={2.4} rotationIntensity={1} floatIntensity={1.6}>
        <Sphere args={[0.28, 32, 32]} position={[1.4, -1.1, 0.3]}>
          <meshStandardMaterial color="#22d3ee" metalness={0.8} roughness={0.1} />
        </Sphere>
      </Float>

      <Float speed={1.6} rotationIntensity={1.4} floatIntensity={1.2}>
        <Sphere args={[0.22, 32, 32]} position={[-1.6, 1.1, -0.4]}>
          <meshStandardMaterial color="#f472b6" metalness={0.7} roughness={0.15} />
        </Sphere>
      </Float>
    </group>
  );
}

export function HeroScene() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 opacity-90">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 5]} intensity={1.2} />
          <pointLight position={[-3, -2, 4]} intensity={0.8} color="#6366f1" />
          <FloatingShapes />
        </Suspense>
      </Canvas>
    </div>
  );
}
