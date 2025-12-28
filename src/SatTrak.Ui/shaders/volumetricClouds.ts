/**
 * Volumetric Cloud Shader for Earth Globe
 * 
 * Uses FBM noise and ray marching through a spherical shell
 * to create realistic volumetric cloud effects.
 * 
 * WebGL/GLSL ES compatible - uses constant loop bounds.
 */

// 3D FBM Noise (based on Inigo Quilez's shadertoy implementation)
export const fbmNoise = /* glsl */ `
  mat3 fbmRotation = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float noise3D(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(
      mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
          mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
      mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
          mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise3D(p); p = fbmRotation * p * 2.02;
    f += 0.2500 * noise3D(p); p = fbmRotation * p * 2.03;
    f += 0.1250 * noise3D(p); p = fbmRotation * p * 2.01;
    f += 0.0625 * noise3D(p);
    return f;
  }
`;

// Ray-sphere intersection for spherical shell
export const raySphereIntersection = /* glsl */ `
  // Returns (near, far) intersection distances, or (-1, -1) if no hit
  vec2 raySphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }
`;

// Cloud density function for spherical shell
export const cloudDensity = /* glsl */ `
  float getCloudDensity(vec3 pos, float innerRadius, float outerRadius, float time) {
    float r = length(pos);
    
    // Height within cloud layer (0 at inner, 1 at outer)
    float heightFraction = (r - innerRadius) / (outerRadius - innerRadius);
    if (heightFraction < 0.0 || heightFraction > 1.0) return 0.0;
    
    // Vertical density falloff (thicker in middle)
    float heightDensity = 1.0 - abs(heightFraction - 0.5) * 2.0;
    heightDensity = pow(heightDensity, 0.5);
    
    // Sample FBM noise at this position (scale for visible patterns)
    vec3 noisePos = pos * 0.8 + vec3(time * 0.01, 0.0, 0.0);
    float cloudNoise = fbm(noisePos);
    
    // Combine: base coverage + noise variation
    float density = (cloudNoise - 0.25) * 3.0;
    density *= heightDensity;
    
    return max(0.0, density);
  }
`;

// Constants for loop bounds (WebGL requires constant expressions)
export const CLOUD_STEPS = 24;
export const SHADOW_STEPS = 6;

// Main ray marching function - uses constant loop bounds for WebGL
export const rayMarch = /* glsl */ `
  #define CLOUD_STEPS 24
  #define SHADOW_STEPS 6
  
  vec4 rayMarchClouds(
    vec3 rayOrigin, 
    vec3 rayDir, 
    vec3 sunDir,
    float innerRadius,
    float outerRadius,
    float time
  ) {
    // Find intersection with outer shell
    vec2 outerHit = raySphere(rayOrigin, rayDir, outerRadius);
    
    // No intersection with outer sphere
    if (outerHit.x < 0.0 && outerHit.y < 0.0) {
      return vec4(0.0);
    }
    
    // Find intersection with inner sphere (Earth surface)
    vec2 innerHit = raySphere(rayOrigin, rayDir, innerRadius);
    
    // Entry: where we enter the cloud shell (outer sphere entry, or 0 if inside)
    float tNear = max(0.0, outerHit.x);
    
    // Exit: where we leave the cloud shell (Earth surface or outer sphere exit)
    float tFar;
    if (innerHit.x > 0.0) {
      // Ray hits inner sphere (Earth), stop there
      tFar = innerHit.x;
    } else {
      // Ray doesn't hit Earth, go to outer sphere exit
      tFar = outerHit.y;
    }
    
    if (tNear >= tFar) {
      return vec4(0.0);
    }
    
    float stepSize = (tFar - tNear) / float(CLOUD_STEPS);
    float shadowStepSize = (outerRadius - innerRadius) * 0.4;
    
    vec3 pos = rayOrigin + rayDir * (tNear + stepSize * 0.5);
    vec4 result = vec4(0.0);
    float transmittance = 1.0;
    
    for (int i = 0; i < CLOUD_STEPS; i++) {
      if (transmittance < 0.01) break;
      
      float density = getCloudDensity(pos, innerRadius, outerRadius, time);
      
      if (density > 0.001) {
        // Shadow march toward sun
        float shadow = 1.0;
        vec3 shadowPos = pos;
        for (int s = 0; s < SHADOW_STEPS; s++) {
          shadowPos += sunDir * shadowStepSize;
          shadow -= getCloudDensity(shadowPos, innerRadius, outerRadius, time) * 0.12;
        }
        shadow = max(0.25, shadow);
        
        // Accumulate color with lighting
        float sampleAlpha = density * stepSize * 1.5;
        vec3 sampleColor = vec3(shadow);
        
        result.rgb += sampleColor * sampleAlpha * transmittance;
        transmittance *= exp(-sampleAlpha);
      }
      
      pos += rayDir * stepSize;
    }
    
    result.a = 1.0 - transmittance;
    return result;
  }
`;

// Complete vertex shader
export const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Complete fragment shader
export const fragmentShader = /* glsl */ `
  precision highp float;
  
  ${fbmNoise}
  ${raySphereIntersection}
  ${cloudDensity}
  ${rayMarch}
  
  uniform vec3 uSunDirection;
  uniform vec3 uCameraPosition;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uTime;
  uniform float uOpacity;
  
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  
  void main() {
    vec3 rayDir = normalize(vWorldPosition - uCameraPosition);
    vec3 sunDir = normalize(uSunDirection);
    
    vec4 cloudColor = rayMarchClouds(
      uCameraPosition,
      rayDir,
      sunDir,
      uInnerRadius,
      uOuterRadius,
      uTime
    );
    
    // Day/night masking based on surface normal vs sun
    float dayMask = smoothstep(-0.15, 0.3, dot(normalize(vWorldPosition), sunDir));
    
    // Final color: white clouds with lighting
    vec3 finalColor = cloudColor.rgb * dayMask + vec3(0.08) * cloudColor.a * (1.0 - dayMask);
    float finalAlpha = cloudColor.a * uOpacity;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;
